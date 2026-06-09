import { useState, useEffect, useCallback, useRef } from "react";

const PIECES = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

const initBoard = () => {
  const b = Array(8).fill(null).map(() => Array(8).fill(null));
  const backRow = ["R","N","B","Q","K","B","N","R"];
  backRow.forEach((p,i) => { b[0][i] = "b"+p; b[7][i] = "w"+p; });
  for(let i=0;i<8;i++) { b[1][i]="bP"; b[6][i]="wP"; }
  return b;
};

const inBounds = (r,c) => r>=0&&r<8&&c>=0&&c<8;
const color = (p) => p?p[0]:null;
const opponent = (c) => c==="w"?"b":"w";

function getRawMoves(board, r, c, state) {
  const p = board[r][c]; if(!p) return [];
  const col = color(p); const type = p[1]; const moves = [];
  const add = (nr,nc) => { if(inBounds(nr,nc)&&color(board[nr][nc])!==col) moves.push([nr,nc]); };
  const slide = (dr,dc) => { let nr=r+dr,nc=c+dc; while(inBounds(nr,nc)){ if(board[nr][nc]){if(color(board[nr][nc])!==col)moves.push([nr,nc]);break;}moves.push([nr,nc]);nr+=dr;nc+=dc; } };
  if(type==="P"){
    const dir=col==="w"?-1:1;
    if(inBounds(r+dir,c)&&!board[r+dir][c]){ moves.push([r+dir,c]); const sr=col==="w"?6:1; if(r===sr&&!board[r+2*dir][c])moves.push([r+2*dir,c]); }
    [[r+dir,c-1],[r+dir,c+1]].forEach(([nr,nc])=>{ if(inBounds(nr,nc)&&color(board[nr][nc])===opponent(col))moves.push([nr,nc]); });
    if(state&&state.enPassant){ const [er,ec]=state.enPassant; [[r+dir,c-1],[r+dir,c+1]].forEach(([nr,nc])=>{ if(nr===er&&nc===ec)moves.push([nr,nc,"ep"]); }); }
  }
  if(type==="N")[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>add(r+dr,c+dc));
  if(type==="B"||type==="Q")[[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>slide(dr,dc));
  if(type==="R"||type==="Q")[[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>slide(dr,dc));
  if(type==="K"){
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc])=>add(r+dr,c+dc));
    if(state&&state.castling){ const row=col==="w"?7:0; if(r===row&&c===4){ if(state.castling[col+"K"]&&!board[row][5]&&!board[row][6]&&board[row][7]===(col+"R"))moves.push([row,6,"castle-k"]); if(state.castling[col+"Q"]&&!board[row][3]&&!board[row][2]&&!board[row][1]&&board[row][0]===(col+"R"))moves.push([row,2,"castle-q"]); } }
  }
  return moves;
}

function isInCheck(board, col) {
  let kr=-1,kc=-1;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(board[r][c]===col+"K"){kr=r;kc=c;}
  if(kr===-1)return false;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){ if(color(board[r][c])===opponent(col)){ if(getRawMoves(board,r,c,{}).some(([mr,mc])=>mr===kr&&mc===kc))return true; } }
  return false;
}

function applyMove(board,from,to,state,promotion="Q"){
  const nb=board.map(r=>[...r]);
  const [fr,fc]=from; const [tr,tc,flag]=to; const p=nb[fr][fc]; const col=color(p);
  nb[tr][tc]=p; nb[fr][fc]=null;
  if(flag==="ep"&&state&&state.enPassant){ const dir=col==="w"?1:-1; nb[tr+dir][tc]=null; }
  if(flag==="castle-k"){ nb[tr][5]=nb[tr][7]; nb[tr][7]=null; }
  if(flag==="castle-q"){ nb[tr][3]=nb[tr][0]; nb[tr][0]=null; }
  if(p[1]==="P"&&(tr===0||tr===7))nb[tr][tc]=col+promotion;
  return nb;
}

function getLegalMoves(board,r,c,state){
  const p=board[r][c]; if(!p)return [];
  const col=color(p);
  return getRawMoves(board,r,c,state).filter(to=>!isInCheck(applyMove(board,[r,c],to,state),col));
}

function getAllLegalMoves(board,col,state){
  const all=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(color(board[r][c])===col)getLegalMoves(board,r,c,state).forEach(to=>all.push({from:[r,c],to}));
  return all;
}

function getGameStatus(board,col,state){
  const moves=getAllLegalMoves(board,col,state);
  if(moves.length===0)return isInCheck(board,col)?"checkmate":"stalemate";
  if(isInCheck(board,col))return "check";
  return "playing";
}

const pieceValue={K:0,Q:900,R:500,B:330,N:320,P:100};
function evaluate(board){ let s=0; for(let r=0;r<8;r++)for(let c=0;c<8;c++){ const p=board[r][c]; if(p){ const v=pieceValue[p[1]]||0; s+=p[0]==="w"?-v:v; } } return s; }

function minimax(board,state,depth,alpha,beta,maximizing){
  const col=maximizing?"b":"w";
  const status=getGameStatus(board,col,state);
  if(status==="checkmate")return maximizing?-100000:100000;
  if(status==="stalemate")return 0;
  if(depth===0)return evaluate(board);
  const moves=getAllLegalMoves(board,col,state);
  if(maximizing){ let best=-Infinity; for(const {from,to} of moves){ const val=minimax(applyMove(board,from,to,state),{},depth-1,alpha,beta,false); best=Math.max(best,val);alpha=Math.max(alpha,best);if(beta<=alpha)break; } return best; }
  else { let best=Infinity; for(const {from,to} of moves){ const val=minimax(applyMove(board,from,to,state),{},depth-1,alpha,beta,true); best=Math.min(best,val);beta=Math.min(beta,best);if(beta<=alpha)break; } return best; }
}

function getBestMove(board,state){
  const moves=getAllLegalMoves(board,"b",state);
  if(!moves.length)return null;
  let best=null,bestVal=-Infinity;
  for(const m of moves){ const val=minimax(applyMove(board,m.from,m.to,state),{},2,-Infinity,Infinity,false); if(val>bestVal){bestVal=val;best=m;} }
  return best;
}

export default function Chess() {
  const [board,setBoard]=useState(initBoard());
  const [selected,setSelected]=useState(null);
  const [legalMoves,setLegalMoves]=useState([]);
  const [turn,setTurn]=useState("w");
  const [gameState,setGameState]=useState({castling:{wK:true,wQ:true,bK:true,bQ:true},enPassant:null});
  const [status,setStatus]=useState("playing");
  const [aiThinking,setAiThinking]=useState(false);
  const [lastMove,setLastMove]=useState(null);
  const [promotionPending,setPromotionPending]=useState(null);
  const [capturedW,setCapturedW]=useState([]);
  const [capturedB,setCapturedB]=useState([]);
  const [mode,setMode]=useState("menu");
  const [playerColor,setPlayerColor]=useState("w");
  const aiRef=useRef(null);

  const resetGame=useCallback(()=>{ setBoard(initBoard());setSelected(null);setLegalMoves([]);setTurn("w");setGameState({castling:{wK:true,wQ:true,bK:true,bQ:true},enPassant:null});setStatus("playing");setAiThinking(false);setPromotionPending(null);setLastMove(null);setCapturedW([]);setCapturedB([]); },[]);

  const executeMove=useCallback((board,from,to,state,promotion="Q")=>{
    const [fr,fc]=from;const [tr,tc,flag]=to;const p=board[fr][fc];const col=color(p);
    const captured=board[tr][tc];
    const nb=applyMove(board,from,to,state,promotion);
    if(captured){if(color(captured)==="w")setCapturedW(prev=>[...prev,captured]);else setCapturedB(prev=>[...prev,captured]);}
    if(flag==="ep"&&state&&state.enPassant){const dir=col==="w"?1:-1;const ep=board[tr+dir][tc];if(ep){if(color(ep)==="w")setCapturedW(prev=>[...prev,ep]);else setCapturedB(prev=>[...prev,ep]);}}
    const nc={...state.castling};
    if(p==="wK"){nc.wK=false;nc.wQ=false;}if(p==="bK"){nc.bK=false;nc.bQ=false;}
    if(p==="wR"&&fr===7&&fc===0)nc.wQ=false;if(p==="wR"&&fr===7&&fc===7)nc.wK=false;
    if(p==="bR"&&fr===0&&fc===0)nc.bQ=false;if(p==="bR"&&fr===0&&fc===7)nc.bK=false;
    let enPassant=null;if(p[1]==="P"&&Math.abs(tr-fr)===2)enPassant=[(fr+tr)/2,tc];
    const newState={castling:nc,enPassant};
    const nextTurn=opponent(col);
    const newStatus=getGameStatus(nb,nextTurn,newState);
    setBoard(nb);setGameState(newState);setTurn(nextTurn);setStatus(newStatus);setLastMove({from,to:[tr,tc]});setSelected(null);setLegalMoves([]);
    return{nb,newState,nextTurn,newStatus};
  },[]);

  useEffect(()=>{
    if(mode!=="playing")return;
    if(turn===playerColor)return;
    if(status!=="playing"&&status!=="check")return;
    setAiThinking(true);
    aiRef.current=setTimeout(()=>{ const best=getBestMove(board,gameState); if(best)executeMove(board,best.from,best.to,gameState); setAiThinking(false); },400);
    return()=>clearTimeout(aiRef.current);
  },[turn,board,gameState,mode,playerColor,status,executeMove]);

  const handleClick=useCallback((r,c)=>{
    if(mode!=="playing"||turn!==playerColor||aiThinking||promotionPending)return;
    if(status!=="playing"&&status!=="check")return;
    const p=board[r][c];
    if(selected){
      const move=legalMoves.find(([mr,mc])=>mr===r&&mc===c);
      if(move){ if(board[selected[0]][selected[1]]==="wP"&&r===0){setPromotionPending({from:selected,to:move});return;} executeMove(board,selected,move,gameState);return; }
      if(p&&color(p)===playerColor){setSelected([r,c]);setLegalMoves(getLegalMoves(board,r,c,gameState));return;}
      setSelected(null);setLegalMoves([]);return;
    }
    if(p&&color(p)===playerColor){setSelected([r,c]);setLegalMoves(getLegalMoves(board,r,c,gameState));}
  },[board,selected,legalMoves,turn,playerColor,gameState,status,aiThinking,promotionPending,mode,executeMove]);

  const toVisual=(r,c)=>playerColor==="w"?[r,c]:[7-r,7-c];
  const boardToRender=playerColor==="w"?board:[...board].reverse().map(r=>[...r].reverse());

  const statusText=()=>{
    if(aiThinking)return"ИИ думает...";
    if(status==="checkmate")return turn===playerColor?"😔 Вы проиграли":"🏆 Вы победили!";
    if(status==="stalemate")return"🤝 Ничья";
    if(status==="check")return turn===playerColor?"⚠️ Вам шах!":"⚠️ Шах ИИ";
    return turn===playerColor?"Ваш ход":"Ход ИИ";
  };

  if(mode==="menu")return(
    <div style={{minHeight:"100vh",background:"#0d0d0f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif",color:"#e8e3d9",padding:"20px"}}>
      <div style={{textAlign:"center",maxWidth:440,width:"100%"}}>
        <div style={{fontSize:80,marginBottom:8}}>♟</div>
        <h1 style={{fontSize:48,fontWeight:800,letterSpacing:"-0.03em",margin:"0 0 8px",background:"linear-gradient(135deg,#d4af37,#f0d060,#b8860b)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CHESS</h1>
        <p style={{color:"#6b6660",fontSize:13,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:40}}>Играй против ИИ</p>
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:32,marginBottom:24}}>
          <p style={{margin:"0 0 16px",fontSize:14,color:"#8a8480"}}>Выберите цвет</p>
          <div style={{display:"flex",gap:12,justifyContent:"center",marginBottom:28}}>
            {[["w","♙","Белые","Ходите первым"],["b","♟","Чёрные","ИИ ходит первым"]].map(([c,sym,name,hint])=>(
              <button key={c} onClick={()=>setPlayerColor(c)} style={{flex:1,padding:"16px 12px",borderRadius:12,border:`2px solid ${playerColor===c?"#d4af37":"rgba(255,255,255,0.1)"}`,background:playerColor===c?"rgba(212,175,55,0.1)":"transparent",color:playerColor===c?"#d4af37":"#8a8480",cursor:"pointer"}}>
                <div style={{fontSize:28,marginBottom:4}}>{sym}</div>
                <div style={{fontSize:13,fontWeight:600}}>{name}</div>
                <div style={{fontSize:11,opacity:0.7,marginTop:2}}>{hint}</div>
              </button>
            ))}
          </div>
          <button onClick={()=>{resetGame();setMode("playing");}} style={{width:"100%",padding:"14px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#d4af37,#b8860b)",color:"#0d0d0f",fontSize:15,fontWeight:700,cursor:"pointer"}}>НАЧАТЬ ИГРУ</button>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:"#0d0d0f",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif",color:"#e8e3d9",padding:"16px",gap:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",maxWidth:520}}>
        <button onClick={()=>setMode("menu")} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"#6b6660",padding:"6px 14px",borderRadius:8,cursor:"pointer",fontSize:13}}>← Меню</button>
        <div style={{fontSize:14,color:"#d4af37",fontWeight:600}}>{statusText()}</div>
        <button onClick={resetGame} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"#6b6660",padding:"6px 14px",borderRadius:8,cursor:"pointer",fontSize:13}}>Новая</button>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:2,width:"100%",maxWidth:520,minHeight:24}}>
        {capturedW.map((p,i)=><span key={i} style={{fontSize:16,opacity:0.6}}>{PIECES[p]}</span>)}
      </div>
      <div style={{position:"relative",borderRadius:8,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.8)"}}>
        {boardToRender.map((row,vr)=>(
          <div key={vr} style={{display:"flex"}}>
            {row.map((piece,vc)=>{
              const [r,c]=toVisual(vr,vc);
              const light=(r+c)%2===0;
              const sel=selected&&selected[0]===r&&selected[1]===c;
              const legal=legalMoves.some(([mr,mc])=>mr===r&&mc===c);
              const last=lastMove&&((lastMove.from[0]===r&&lastMove.from[1]===c)||(lastMove.to[0]===r&&lastMove.to[1]===c));
              const inChk=piece&&piece[1]==="K"&&piece[0]===turn&&status==="check";
              let bg=light?"#f0d9b5":"#b58863";
              if(sel)bg="#f6f669";else if(last)bg=light?"#cdd16e":"#aaa23a";
              if(inChk)bg="#e74c3c";
              return(
                <div key={vc} onClick={()=>handleClick(r,c)} style={{width:64,height:64,background:bg,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",cursor:"pointer",userSelect:"none"}}>
                  {legal&&!piece&&<div style={{width:"32%",height:"32%",borderRadius:"50%",background:"rgba(0,0,0,0.18)"}}/>}
                  {legal&&piece&&<div style={{position:"absolute",inset:0,border:"3px solid rgba(0,0,0,0.2)",boxSizing:"border-box"}}/>}
                  {piece&&<span style={{fontSize:40,lineHeight:1,transform:sel?"scale(1.15)":"scale(1)",transition:"transform 0.1s"}}>{PIECES[piece]}</span>}
                  {vc===0&&<span style={{position:"absolute",top:2,left:3,fontSize:10,color:light?"#b58863":"#f0d9b5",fontWeight:600}}>{8-r}</span>}
                  {vr===7&&<span style={{position:"absolute",bottom:2,right:3,fontSize:10,color:light?"#b58863":"#f0d9b5",fontWeight:600}}>{"abcdefgh"[c]}</span>}
                </div>
              );
            })}
          </div>
        ))}
        {aiThinking&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{background:"rgba(13,13,15,0.9)",border:"1px solid rgba(212,175,55,0.3)",borderRadius:10,padding:"12px 24px",color:"#d4af37",fontSize:14,fontWeight:600}}>♟ ИИ думает...</div></div>}
        {(status==="checkmate"||status==="stalemate")&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
          <div style={{fontSize:48}}>{status==="checkmate"?(turn===playerColor?"😔":"🏆"):"🤝"}</div>
          <div style={{fontSize:22,fontWeight:700,color:"#d4af37"}}>{status==="stalemate"?"Ничья":turn===playerColor?"Вы проиграли":"Вы победили!"}</div>
          <button onClick={resetGame} style={{background:"linear-gradient(135deg,#d4af37,#b8860b)",color:"#0d0d0f",border:"none",padding:"10px 28px",borderRadius:8,fontWeight:700,cursor:"pointer",fontSize:15}}>Играть снова</button>
        </div>}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:2,width:"100%",maxWidth:520,minHeight:24}}>
        {capturedB.map((p,i)=><span key={i} style={{fontSize:16,opacity:0.6}}>{PIECES[p]}</span>)}
      </div>
      {promotionPending&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
        <div style={{background:"#1a1a1f",border:"1px solid rgba(212,175,55,0.3)",borderRadius:16,padding:24,textAlign:"center"}}>
          <p style={{margin:"0 0 16px",color:"#d4af37",fontWeight:600}}>Выберите фигуру</p>
          <div style={{display:"flex",gap:12}}>
            {["Q","R","B","N"].map(p=>(
              <button key={p} onClick={()=>{executeMove(board,promotionPending.from,promotionPending.to,gameState,p);setPromotionPending(null);}} style={{width:60,height:60,fontSize:36,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,cursor:"pointer"}}>{PIECES["w"+p]}</button>
            ))}
          </div>
        </div>
      </div>}
    </div>
  );
}