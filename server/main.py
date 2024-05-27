'''
Usage:
Ark v3 sdk
pip install 'volcengine-python-sdk[ark]'
'''


from volcenginesdkarkruntime import Ark
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List


# fetch ak&sk from environmental variables "VOLC_ACCESSKEY", "VOLC_SECRETKEY"
# or specify ak&sk by Ark(ak="${YOUR_AK}", sk="${YOUR_SK}").
# you can get ak&sk follow this document(https://www.volcengine.com/docs/6291/65568)

client = Ark(ak = "xxxxxxxxxxxxxxxx",sk = "xxxxxxxxxxxxxxxxxx==")
YOUR_ENDPOINT_ID = "ep-xxx-xxxxxxxxxxxxxxx"

app = FastAPI()

if __name__ == "__main__":
    # Non-streaming:
    print("----- standard request -----")
    completion = client.chat.completions.create(
        model="ep-20240526112518-f2m5k",
        messages=[
            {
                "role": "user",
                "content": "你好啊",
            },
        ]
    )
    print(completion.choices[0].message.content)
# 因为是xxxx发起的，所以需要要把抖音的这个地址加进去    
origins = [
    "https://blog.lemonhall.me",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

system_prompt = """// 你现在扮演一个游戏里的普通npc，对话的回复使用json格式，
// 我先与你对话，并向你问好："你好啊"
// 你应该回复如下：
// {response:"你也好啊",choices:["你现在有空么？","没事情了","没事了"]}
// 其中response是你的回复，choices则是你撰写的，我有可能的下一轮的问题。其中choices里面最后的一个答案一定是"没事了"
// 并且这个choices列表里也必须要有3个选项

// 你拥有以下两个可能的action,
// 你的action_list:["钓鱼":"当你在response当中有钓鱼的想法时，可以使用这个action能力","唱首歌":"当你在response中有其它想法的时候，使用这个action“]

// 当你产生了这样的想法时候，请在回复时，带上接下来你将要做的action:
// 比如：
// {"response":"我们可以去钓鱼呀","choices":["好呀，那就出发吧","还是算了吧"],next_action:["钓鱼"]}"""



class aMessage(BaseModel):
    content: str

chat_history = []
# 把提示词先弄进去，只需要注入一次
chat_history.append({"role":"system","content": system_prompt})

@app.post("/v1/completions")
async def main(a_Message: aMessage):
    # 把用户输入弄进去
    chat_history.append({"role":"user","content": a_Message.content})
    completion = client.chat.completions.create(
        model="ep-20240526112518-f2m5k",
        messages=chat_history
    )
    print(a_Message.content)
    respone = completion.choices[0].message.content
    print(respone)
    # 把系统的回复注入进去
    chat_history.append({"role":"assistant","content": respone})
    print(chat_history)
    print(len(chat_history))
    return respone
#用这个去启动
#建立环境
#python3 -m venv .venv
#激活环境
#source .venv/bin/activate
#服务启动
#uvicorn main:app --reload
#安装依赖
#pip install fastapi fastapi-cors uvicorn requests
#可能的一个bug
#不知道是不是误删了还是怎么了，长期运行，然后之间.venv不见了，可能是误删了，不管了
