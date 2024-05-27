import {b as browser} from "./libs/ollama.js";
//import { b as browser } from './theModule';
// test.js
window.saySth = async function(my_choice,that) {
    //我把event的指针做了一个深度的拷贝，这样就不会被事件影响了，等于总是存储着发起调用的那个event
    var that = JSON.parse(JSON.stringify(that));
    console.log(that);
    console.log("触发该事件的NPC或物体的ID是："+that._eventId);
    var eventId = that._eventId;
    var npc = $gameMap.event(eventId);
    var player = $gamePlayer;
    console.log("player:")
    console.log(player)
    //https://docs.google.com/spreadsheets/d/1-Oa0cRGpjC8L5JO8vdMwOaYMKO75dtfKDOetnvh7OHs/edit#gid=1956861054
    //4是向左移动，移动两次
    //direction = 2 (down), 4 (left), 6 (right), or 8 (up)
    //npc.moveStraight(4); 
    //跳起来（原地跳）
    //npc.jump(0, 0); 
    //"// Get the player character
    //this.character(-1)
    // Get ""This Event""
    //this.character(0)
    // Get map event ID 7
    //this.character(7)"(
    //让NPC向固定的一个event移动，这样就可以实现一些动画效果了，稍微麻烦了一丢丢；
    let count = 0;
    function executeFunction() {
                npc.moveTowardCharacter($gameMap.event(7));
                count++;
                if (count === 25) {
                    clearInterval(intervalId);
                }
    }
    let intervalId = setInterval(executeFunction, 500);
    //让某个人物显示气泡：
    //1、惊讶；2、问号；3、音符；4、心形；5、生气；6、流汗；7、纠结；8、沉默；9、灯泡；10、呼呼；
    //$gameTemp.requestBalloon(player, 3);
    //清除本事件
    //$gameMap.eraseEvent(id);
    
    var choices_list =[];
    if (my_choice!== undefined && my_choice!== null) {
        // 有值时的处理逻辑
      } else {
        // 外部调用者没传值时的处理逻辑
        my_choice = '你好啊'
      }

    // 函数的具体实现
    fetch('http://127.0.0.1:8000/v1/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: my_choice
        }),
      })
      .then(response => response.json())
      .then(function(data){
                console.log("NPC回复："+data)
                //NPC回复：{"response":"你也好啊","choices":["今天天气怎么样？","一起去逛逛吧","没事了"]}
                //'{"response":"好呀","choices":["那赶紧去吧","准备下工具","没事了"],"next_action":["钓鱼"]}'}]
                var res = JSON.parse(data);
                console.log(res.response);
                $gameMessage.add(res.response);
                if(res.next_action!== undefined && res.next_action!== null){
                    $gamePlayer.requestBalloon(3);
                }else{
                            //TODO:Parser response to get a choice list
                            choices_list = res.choices;
                            // Set choices to A, B, C; default C, no cancel
                            $gameMessage.setChoices(choices_list, 2, 2);
                            $gameMessage.setChoiceCallback(async n => {
                                console.log("我选择了n："+n);
                                my_choice = choices_list[n];
                                console.log("我的选择："+my_choice)
                                if(n == 2){
                                    $gameMessage.add("好的，回见")
                                }else{
                                    saySth(my_choice,that);
                                }
                            });
                }     
       })
      .catch(error => console.error('出错了:', error));
};
// 你现在扮演一个游戏里的普通npc，对话的回复使用json格式，
// 我先与你对话，并向你问好："你好啊"
// 你应该回复如下：
// {response:"你也好啊",choices:["你现在有空么？","没事情了"]}
// 其中response是你的回复，choices则是你撰写的，我有可能的下一轮的问题。

// 你拥有以下两个可能的action,
// 所以你的action_list:["钓鱼":"当你在response当中有钓鱼的想法时，可以使用这个action能力","唱首歌":"当你在response中有其它想法的时候，使用这个action“]

// 当你产生了这样的想法时候，请在回复时，带上接下来你将要做的action:
// 比如：
// {"response":"我们可以去钓鱼呀","choices":["好呀，那就出发吧","还是算了吧"],next_action:["钓鱼"]}
