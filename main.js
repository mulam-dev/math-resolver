import "./ext-lang/all.js";
import {Pair} from "./ext-lang/ext-lib/luth.js";
import {assertEquals as assert} from "https://deno.land/std@0.219.0/assert/mod.ts";

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

let indent = 0;

const indent_in = (idn = 1) => indent += idn;

const indent_out = (idn = 1) => indent -= idn;

const print = (...msg) => console.log(''.padStart(indent * 4), ...msg);

const expr_to_dsp = ({head, data}) => {
    switch (head) {
        case "udef":
            return ["udef"];
        case "num":
            return [data];
        case "var":
            return [data];
        case "sopt":
            return [...expr_to_dsp(data.vals[0]), data.opt, ...expr_to_dsp(data.vals[1])];
        default:
            return ["<unknown>"];
    }
};

const make_ctx = () => ({});

const runner = (ctx, {head, data}) => {
    switch (head) {
        case "assign":
            cmd_assign(ctx, data);
            break;
        case "eval":
            cmd_eval(ctx, data);
            break;
    }
};

const expr_to_pass = ({head, data}) => {
    switch (head) {
        case "num":
            return data;
        case "var":
            return data;
        case "sopt":
            return [data.opt, ...data.vals.map(expr_to_pass)];
        default:
            return "<unknown>";
    }
};

const pass_vars = pass => {
    switch (typeof pass) {
        case "number": return [];
        case "string": return [pass];
        case "object": return pass.slice(1).flatMap(pass_vars);
    }
};

const pass_extract = (pass, idx, inv) => OPTS[pass[0]].extract(idx, inv, ...pass.slice(1));

const make_pass = (opt, ...vals) => OPTS[opt].resolve(...vals);

const find_var = (pvar, pass) => {
    for (let i = 1; i < pass.length; i++) {
        const part = pass[i];
        if (typeof part === "string") {
            if (part === pvar)
                return [i - 1];
            else
                return null;
        }
        const res = find_var(pvar, part);
        if (res) return [i - 1].concat(res);
    }
    return null;
};

Deno.test(function find_var_test() {
    assert(
        find_var('x', ['+', ['+', 3, 4], ['+', 'x', 2]]),
        [1, 0],
    );
});

const extract_var = (pvar, pass_var) => {
    if (typeof pass_var === "string") return 0;
    const route = find_var(pvar, pass_var);
    let pass = pass_var, inv = 0;
    for (const idx of route) {
        [pass, inv] = pass_extract(pass, idx, inv);
    }
    return inv;
};

Deno.test(function extract_var_test() {
    assert(
        extract_var('x', ['+', 'x', 3]),
        -3,
    );
});

const cmd_assign = (ctx, {tar, expr}) => {
    print(tar, '=', ...expr_to_dsp(expr));
    if (!(ctx[tar] instanceof Array)) ctx[tar] = [];
    let pass, vars;
    switch (expr.head) {
        case "udef":
            break;
        case "num":
        case "var":
        case "sopt":
            pass = expr_to_pass(expr);
            vars = Set.new([tar].concat(pass_vars(pass))).values();
            for (const v of vars) ctx[v].unshift([tar, pass]);
            break;
    }
};

const cmd_eval = (ctx, {tar}) => {
    print(tar, '?');
};

const OPTS = {
    '+': {
        extract: (idx, inv, a, b) => idx === 0 ?
            [a, make_pass('-', inv, b)] :
            [b, make_pass('-', inv, a)],
        resolve: (...vals) => {
            switch (vals.length) {
                case 1: return vals[0];
                case 2:
                    if (typeof vals[0] === "number" && typeof vals[1] === "number") return vals[0] + vals[1];
                    // TODO
                    return ['+', ...vals];
            }
        },
    },
    '-': {
        resolve: (a, b) => {
            return make_pass('+', a, make_pass('!', b));
        },
    },
    '!': {
        extract: (_, inv, val) => ([val, make_pass('!', inv)]),
        resolve: val => {
            switch (typeof val) {
                case "number": return -val;
                case "string": return ['!', val];
                case "object":
                    switch (val[0]) {
                        case "!": return val[1];
                    }
                    return ['!', val];
            }
        },
    },
    '*': {
        rev: '/',
    },
    '/': {
        rev: '*',
    },
};

if (import.meta.main) {
    // Word.log_all = true;
    // Word.log_result = true;
    const exprs = reader.extract_from(`
        x = udef
        y = x + 3
        y = 1
        x ?
    `);
    const ctx = make_ctx();
    for (const cmd of exprs) runner(ctx, cmd);
    ctx.ll;
}
