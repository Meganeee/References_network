//MicrosoftAcademicAPIへの送信クラス
var MSAcademicGateway=function(){
    //APIへ送るパラメータ。"expr"は指定する必要がある。
    this.params={
        "expr": "expr",
        "model": "latest",
        "count": "1",
        "offset": "0",
        "attributes": "Id,RId,ECC,Y,Ti,AA.AuN",
    };
    //APIへ送る。現状POSTのみにしか対応していない。また、同期設定になっているため見直す必要がある。
    this.sendData=function(httpType,timeout){
        if(httpType=="POST"){
            var returndata;
            $.ajax({
                url: "https://api.labs.cognitive.microsoft.com/academic/v1.0/evaluate",// + $.param(params),
                beforeSend: function(xhrObj){
                    xhrObj.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
                    xhrObj.setRequestHeader("Ocp-Apim-Subscription-Key","----------------------");
                },
                type: httpType,
                async: false,
                data: $.param(this.params),
                timeout: timeout,
            })
            .done(function(data){
                 console.log("success");
                returndata=data.entities;
            })
            .fail(function(){
                console.log("error");
            });
        }   
        return returndata;
    };
};

//辞書型のqueries(キュー{RId:[1234,5678],Ti:"The ~",})に関するクラス
var Queries=function(queries){
    this.queries=queries;
    //単一のキューを整形。文字列としてのキューが返ってくる。
    this.formatQuery=function(key,value){
        //文字列は小文字でないと判定されないため
        if($.type(value)==="string"){
            value=value.toLowerCase();
            value="'"+value+"'";
        }
        var query;
        if(key.match(/\./)){
            query="Composite("+key+"="+value+")";
        }
        else{
            query=key+"="+value;
        }
        return(query);
    };
    //複数のキューを整形し結合。AND結合かOR結合を選べる。
    this.formatQueries=function(logical){
        //キューを整形しリストに詰め込む。valueがリスト形式の場合にも対応。
        var exprList=[];
        for(var key in queries){
            if(Array.isArray(queries[key])){
                for(var index in queries[key]){
                    exprList.push(this.formatQuery(key,queries[key][index]));
                }
            }else{
                exprList.push(this.formatQuery(key,queries[key]));
            }
        }
        //全体をANDORで囲む。
        var str="("+exprList.join(",")+")";
        if(logical=="AND"){
            str="And"+str;
        }
        else if(logical=="OR"){
            str="Or"+str;
        }
        return(str);
    };
};
//リストでまとめられたJSONを扱うクラス。
var ListJSON=function(data){
    this.data=data;
    //keyの値がsearchvalueのオブジェクトを返す。
    this.match=function(searchKey,searchValue){
        var matchedData=this.data.filter(function(element){
            return(element[searchKey]==searchValue);
        });
        return(matchedData);
    };
    //keyの値がsearchvalueのオブジェクトを返し、それらのあるキーをリスト化する。
    this.popValue=function(searchKey,searchValue,popKey){
        var matchedData=this.match(searchKey,searchValue);
        var popedValue=matchedData.map(function(element){
            return(element[popKey]);
        });
        return(popedValue);
    };
    //全てのオブジェクトのpopKeyをリスト化する。
    this.popValueList=function(popKey){
        var valueList=[];
        for(var i in this.data){
            valueList=valueList.concat(this.data[i][popKey]);
        }
        return(valueList);
    };
};

function getRIdfromId(listJSON,newListJSON,rank){
    if(rank!=0){
        var RIdList=newListJSON.popValueList("RId");
        var RIdQueries=new Queries({"Id":RIdList});
        var apiGateway=new MSAcademicGateway();
        apiGateway.params.expr=RIdQueries.formatQueries("OR");
        apiGateway.params.count="1000";
        var returnListJSON=new ListJSON(apiGateway.sendData("POST",10000));
        listJSON.data=listJSON.data.concat(returnListJSON.data);
        return(getRIdfromId(listJSON,returnListJSON,rank-1));
    }else{
        return(listJSON);
    }
}
function add_ECC_per_year(allJSON){
    var now=new Date();
    var year=now.getFullYear();
    for(var i of allJSON){
        i["ECC_per_year"]=i.ECC/(year-i.Y);
    }
    return allJSON;
}

$('#search').click(function(){
    var colectedValue={Ti:$('#Title').val()};
    var rank=1;
    //キューの整形
    var queries=new Queries(colectedValue);
    var formatedQueries=queries.formatQueries("OR");
    //タイトルをAPIに送る
    var apiGateway=new MSAcademicGateway();
    apiGateway.params.expr=formatedQueries;
    var allJSON=apiGateway.sendData("POST",10000);
    //配列型のJSONとしてリスト化
    var listJSON=new ListJSON(allJSON);
    //最初のデータから芋づる式に論文データを取得
    listJSON=getRIdfromId(listJSON,listJSON,rank);
    //全データに被引用数/年月のデータを追加
    listJSON.data=add_ECC_per_year(listJSON.data);
    //cytoscapeにデータを渡す
    showCytoscape(listJSON.data);
});

function showCytoscape(JSONdata){
    var cy=cytoscape({
        container:document.getElementById('cy'),
        style:[{
            selector:'node',
            style:{
                shape:'circle',
                'background-color':'red',
                label:'data(Ti)',
                width:'mapData(ECC_per_year,0,1000,20,60)',
                height:'mapData(ECC_per_year,0,1000,20,60)'
            }
        },
        {
            selector:'edge',
            style:{
                'width':3,
                'line-color':'#ccc',
            }
        }],
        minZoom:0.1,
        maxZoom:10
    });
    //ノードを作成。各ノードには固有のidが必要。
    for(var i of JSONdata){
        i["id"]=i.Id;
        cy.add({
            data:i
        });
    }
    var idlist=JSONdata.map(function(p){
        return p.id;
    });
    //エッジを作成。エッジは接続先のノードがなければ作成できないためノードとは別に作成。
    for(var x of JSONdata){
        var source=x.id;
        if("RId" in x){
            for(var j of x.RId){
                //console.log(j);
                if(idlist.indexOf(String(j))>=0){
                    //console.log("hit"+j);
                    cy.add({
                        data:{
                            id:source+"to"+j,
                            source:source,
                            target:j
                        }
                    });
                }
                else;
            }    
        }
        else;
    }
    cy.layout({
        name: 'concentric',
        concentric:function(n){
            return n.degree();
        },
        levelWidth:function(nodes){
            return 4;
        }
    }).run();
}