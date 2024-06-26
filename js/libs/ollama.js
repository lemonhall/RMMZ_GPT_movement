const version = "0.5.1";

class ResponseError extends Error {
  constructor(error, status_code) {
    super(error);
    this.error = error;
    this.status_code = status_code;
    this.name = "ResponseError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ResponseError);
    }
  }
}
const checkOk = async (response) => {
  if (!response.ok) {
    let message = `Error ${response.status}: ${response.statusText}`;
    let errorData = null;
    if (response.headers.get("content-type")?.includes("application/json")) {
      try {
        errorData = await response.json();
        message = errorData.error || message;
      } catch (error) {
        console.log("Failed to parse error response as JSON");
      }
    } else {
      try {
        console.log("Getting text from response");
        const textResponse = await response.text();
        message = textResponse || message;
      } catch (error) {
        console.log("Failed to get text from error response");
      }
    }
    throw new ResponseError(message, response.status);
  }
};
function getPlatform() {
  if (typeof window !== "undefined" && window.navigator) {
    return `${window.navigator.platform.toLowerCase()} Browser/${navigator.userAgent};`;
  } else if (typeof process !== "undefined") {
    return `${process.arch} ${process.platform} Node.js/${process.version}`;
  }
  return "";
}
const fetchWithHeaders = async (fetch, url, options = {}) => {
  const defaultHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": `ollama-js/${version} (${getPlatform()})`
  };
  if (!options.headers) {
    options.headers = {};
  }
  options.headers = {
    ...defaultHeaders,
    ...options.headers
  };
  return fetch(url, options);
};
const get = async (fetch, host) => {
  const response = await fetchWithHeaders(fetch, host);
  await checkOk(response);
  return response;
};
const head = async (fetch, host) => {
  const response = await fetchWithHeaders(fetch, host, {
    method: "HEAD"
  });
  await checkOk(response);
  return response;
};
const post = async (fetch, host, data, options) => {
  const isRecord = (input) => {
    return input !== null && typeof input === "object" && !Array.isArray(input);
  };
  const formattedData = isRecord(data) ? JSON.stringify(data) : data;
  const response = await fetchWithHeaders(fetch, host, {
    method: "POST",
    body: formattedData,
    signal: options?.signal
  });
  await checkOk(response);
  return response;
};
const del = async (fetch, host, data) => {
  const response = await fetchWithHeaders(fetch, host, {
    method: "DELETE",
    body: JSON.stringify(data)
  });
  await checkOk(response);
  return response;
};
const parseJSON = async function* (itr) {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  const reader = itr.getReader();
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(chunk);
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      try {
        yield JSON.parse(part);
      } catch (error) {
        console.warn("invalid json: ", part);
      }
    }
  }
  for (const part of buffer.split("\n").filter((p) => p !== "")) {
    try {
      yield JSON.parse(part);
    } catch (error) {
      console.warn("invalid json: ", part);
    }
  }
};
const formatHost = (host) => {
  if (!host) {
    return "http://127.0.0.1:11434";
  }
  let isExplicitProtocol = host.includes("://");
  if (host.startsWith(":")) {
    host = `http://127.0.0.1${host}`;
    isExplicitProtocol = false;
  }
  if (!isExplicitProtocol) {
    host = `http://${host}`;
  }
  const url = new URL(host);
  let port = url.port;
  if (!port) {
    if (!isExplicitProtocol) {
      port = "11434";
    } else {
      port = url.protocol === "https:" ? "443" : "80";
    }
  }
  let formattedHost = `${url.protocol}//${url.hostname}:${port}${url.pathname}`;
  if (formattedHost.endsWith("/")) {
    formattedHost = formattedHost.slice(0, -1);
  }
  return formattedHost;
};

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
let Ollama$1 = class Ollama {
  constructor(config) {
    __publicField(this, "config");
    __publicField(this, "fetch");
    __publicField(this, "abortController");
    this.config = {
      host: ""
    };
    if (!config?.proxy) {
      this.config.host = formatHost(config?.host ?? "http://127.0.0.1:11434");
    }
    this.fetch = fetch;
    if (config?.fetch != null) {
      this.fetch = config.fetch;
    }
    this.abortController = new AbortController();
  }
  // Abort any ongoing requests to Ollama
  abort() {
    this.abortController.abort();
    this.abortController = new AbortController();
  }
  async processStreamableRequest(endpoint, request) {
    request.stream = request.stream ?? false;
    const response = await post(
      this.fetch,
      `${this.config.host}/api/${endpoint}`,
      {
        ...request
      },
      { signal: this.abortController.signal }
    );
    if (!response.body) {
      throw new Error("Missing body");
    }
    const itr = parseJSON(response.body);
    if (request.stream) {
      return async function* () {
        for await (const message of itr) {
          if ("error" in message) {
            throw new Error(message.error);
          }
          yield message;
          if (message.done || message.status === "success") {
            return;
          }
        }
        throw new Error("Did not receive done or success response in stream.");
      }();
    } else {
      const message = await itr.next();
      if (!message.value.done && message.value.status !== "success") {
        throw new Error("Expected a completed response.");
      }
      return message.value;
    }
  }
  async encodeImage(image) {
    if (typeof image !== "string") {
      const uint8Array = new Uint8Array(image);
      const numberArray = Array.from(uint8Array);
      const base64String = btoa(String.fromCharCode.apply(null, numberArray));
      return base64String;
    }
    return image;
  }
  async generate(request) {
    if (request.images) {
      request.images = await Promise.all(request.images.map(this.encodeImage.bind(this)));
    }
    return this.processStreamableRequest("generate", request);
  }
  async chat(request) {
    if (request.messages) {
      for (const message of request.messages) {
        if (message.images) {
          message.images = await Promise.all(
            message.images.map(this.encodeImage.bind(this))
          );
        }
      }
    }
    return this.processStreamableRequest("chat", request);
  }
  async create(request) {
    return this.processStreamableRequest("create", {
      name: request.model,
      stream: request.stream,
      modelfile: request.modelfile,
      quantize: request.quantize
    });
  }
  async pull(request) {
    return this.processStreamableRequest("pull", {
      name: request.model,
      stream: request.stream,
      insecure: request.insecure
    });
  }
  async push(request) {
    return this.processStreamableRequest("push", {
      name: request.model,
      stream: request.stream,
      insecure: request.insecure
    });
  }
  async delete(request) {
    await del(this.fetch, `${this.config.host}/api/delete`, {
      name: request.model
    });
    return { status: "success" };
  }
  async copy(request) {
    await post(this.fetch, `${this.config.host}/api/copy`, { ...request });
    return { status: "success" };
  }
  async list() {
    const response = await get(this.fetch, `${this.config.host}/api/tags`);
    const listResponse = await response.json();
    return listResponse;
  }
  async show(request) {
    const response = await post(this.fetch, `${this.config.host}/api/show`, {
      ...request
    });
    const showResponse = await response.json();
    return showResponse;
  }
  async embeddings(request) {
    const response = await post(this.fetch, `${this.config.host}/api/embeddings`, {
      ...request
    });
    const embeddingsResponse = await response.json();
    return embeddingsResponse;
  }
};
const browser = new Ollama$1();

export { Ollama$1 as O, browser as b, head as h, post as p };
