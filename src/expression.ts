// Deliberately small expression language: no eval, property access, or JavaScript execution.
export type Expression = (x:number,y:number,z:number)=>number;
const functions: Record<string, (...values:number[])=>number>={sin:Math.sin,cos:Math.cos,tan:Math.tan,abs:Math.abs,sqrt:Math.sqrt,exp:Math.exp,log:Math.log,floor:Math.floor,ceil:Math.ceil,min:Math.min,max:Math.max,pow:Math.pow,atan2:Math.atan2,tanh:Math.tanh};
export function compileExpression(source: string): Expression{
 if(typeof source!=='string'||source.length>400)throw Error('Expressions must be text with at most 400 characters.');
 const tokens=source.match(/(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z_0-9]*|===|!==|<=|>=|==|!=|\*\*|[^\s]/g)||[];let at=0,nodes=0;
 function parse(min=0): Expression{
  if(++nodes>150)throw Error('Expression is too complex.');
  let t=tokens[at++],left: Expression;
  if(t==='+'||t==='-'){const v=parse(5);left=t==='-'?(x,y,z)=>-v(x,y,z):v;}
  else if(t==='('){left=parse();if(tokens[at++]!==')')throw Error('Expected closing parenthesis.');}
  else if(t && /^(?:\d|\.)/.test(t)){const v=Number(t);if(!Number.isFinite(v))throw Error('Invalid number.');left=()=>v;}
  else if(['x','y','z'].includes(t)){left=t==='x'?(x)=>x:t==='y'?(x,y)=>y:(x,y,z)=>z;}
  else if(t==='pi'||t==='e'){const v=t==='pi'?Math.PI:Math.E;left=()=>v;}
  else if(Object.hasOwn(functions,t)){
   if(tokens[at++]!=='(')throw Error(`Expected ( after ${t}.`);
   const args=[parse()];while(tokens[at]===','){at++;args.push(parse());}if(tokens[at++]!==')')throw Error('Expected closing parenthesis.');
   const arity=['min','max','pow','atan2'].includes(t)?2:1;if(args.length!==arity)throw Error(`${t} expects ${arity} argument(s).`);
   const fn=functions[t];left=(x,y,z)=>fn(...args.map(a=>a(x,y,z)));
  }else throw Error(`Unexpected token: ${t??'end of expression'}.`);
  while(at<tokens.length){const op=tokens[at],precedence: number|undefined=({'==':1,'!=':1,'===':1,'!==':1,'<':2,'<=':2,'>':2,'>=':2,'+':3,'-':3,'*':4,'/':4,'^':6,'**':6} as Record<string,number>)[op];if(!precedence||precedence<min)break;at++;const right=parse(precedence+(precedence===6?0:1)),l=left;left=(x,y,z)=>{const a=l(x,y,z),b=right(x,y,z);switch(op){case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':return a/b;case '<':return Number(a<b);case '<=':return Number(a<=b);case '>':return Number(a>b);case '>=':return Number(a>=b);case '==':case '===':return Number(a===b);case '!=':case '!==':return Number(a!==b);default:return a**b;}};}
  if(min===0&&tokens[at]==='?'){
   at++;const condition=left,yes=parse();
   if(tokens[at++]!==':')throw Error('Expected : in conditional expression.');
   const no=parse();left=(x,y,z)=>condition(x,y,z)?yes(x,y,z):no(x,y,z);
  }
  return left;
 }
 const result=parse();if(at!==tokens.length)throw Error(`Unexpected token: ${tokens[at]}. Use * for multiplication.`);return result;
}
