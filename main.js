import "./ext-lang/all.js";
import {Pair} from "./ext-lang/ext-lib/luth.js";

const DEMO = `

x = udef
y = x + 3
y = 1
x ?

`;

// 词: 未定义
const w_udef = pair("udef", first(str("udef"))).name("udef");
// 词: 变量名
const w_var = pair("var", first(join(seq(not(w_udef), /[a-zA-Z]/, any(/[0-9a-zA-Z]/))))).name("var");
// 词: 数字
const w_num = pair("num", trans(join(some(/[0-9.]/)), str => Number.parseFloat(str))).name("num");
// 词: 有值
const w_val = or(w_var, w_num).name("val");
// 词: 运算符
const w_opt = pair("opt", first(reg(/[+\-*/]/))).name("opt");

// 句: 运算式
const s_opt = new Word();
    s_opt
        .ref(pair("sopt", trans(wseq(w_val, w_opt, or(s_opt, w_val)),
                                (...ds) => ds
                                    .filter(d => d instanceof Pair)
                                    .compose(([val1, opt, val2]) => ({opt: opt.data, vals: [val1, val2]})))))
        .name("sopt");
// 句: 表达式
const s_expr = or(s_opt, w_val, w_udef).name("expr");
// 句: 赋值
const s_assign = pair("assign", trans(wseq(w_var, '=', s_expr),
                                      (...ds) => ds
                                        .filter(d => d instanceof Pair)
                                        .compose(([pvar, expr]) => ({tar: pvar.data, expr}))))
    .name("assign");
// 句: 求值
const s_eval = pair("eval", trans(wseq(w_var, '?'),
                                  (...ds) => ds
                                    .filter(d => d instanceof Pair)
                                    .compose(([pvar]) => ({tar: pvar.data}))))
    .name("eval");

const reader = trans(wany(or(s_assign, s_eval, blank)), (...ds) => ds.filter(d => d instanceof Pair));

if (import.meta.main) {
    // Word.log_all = true;
    // Word.log_result = true;
    reader.extract_from(DEMO).ll;
}
