# 論文引用の可視化
このコンテンツはcytoscape.jsとMicrosoftAcademicKnowlwdge_APIkeyが必要です。

1.論文タイトルを入力。
2.MicrosoftAcademicKnowlwdgeからその論文を引っ張てくる。
  （発行年、引用、著者、被引用数・・・）
3.引っ張った論文の引用を調べ、それをまた引っ張ってくる。
4.　2.3.を規定回数繰り返す。
  （今は１ループだけ）
5.cytoscape.jsによって引用をネットワーク状にして表示。
  （ノードの大きさは被引用数）
