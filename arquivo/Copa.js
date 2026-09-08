(function() {
    const e = document.createElement("link").relList;
    if (e && e.supports && e.supports("modulepreload"))
        return;
    for (const r of document.querySelectorAll('link[rel="modulepreload"]'))
        n(r);
    new MutationObserver(r => {
        for (const l of r)
            if (l.type === "childList")
                for (const a of l.addedNodes)
                    a.tagName === "LINK" && a.rel === "modulepreload" && n(a)
    }
    ).observe(document, {
        childList: !0,
        subtree: !0
    });
    function t(r) {
        const l = {};
        return r.integrity && (l.integrity = r.integrity),
        r.referrerPolicy && (l.referrerPolicy = r.referrerPolicy),
        r.crossOrigin === "use-credentials" ? l.credentials = "include" : r.crossOrigin === "anonymous" ? l.credentials = "omit" : l.credentials = "same-origin",
        l
    }
    function n(r) {
        if (r.ep)
            return;
        r.ep = !0;
        const l = t(r);
        fetch(r.href, l)
    }
}
)();
function Tc(A) {
    return A && A.__esModule && Object.prototype.hasOwnProperty.call(A, "default") ? A.default : A
}
var Du = {
    exports: {}
}
  , pl = {}
  , Hu = {
    exports: {}
}
  , E = {};
/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var _n = Symbol.for("react.element")
  , hc = Symbol.for("react.portal")
  , Mc = Symbol.for("react.fragment")
  , bc = Symbol.for("react.strict_mode")
  , zc = Symbol.for("react.profiler")
  , gc = Symbol.for("react.provider")
  , Vc = Symbol.for("react.context")
  , Xc = Symbol.for("react.forward_ref")
  , qc = Symbol.for("react.suspense")
  , Oc = Symbol.for("react.memo")
  , kc = Symbol.for("react.lazy")
  , go = Symbol.iterator;
function Pc(A) {
    return A === null || typeof A != "object" ? null : (A = go && A[go] || A["@@iterator"],
    typeof A == "function" ? A : null)
}
var Ju = {
    isMounted: function() {
        return !1
    },
    enqueueForceUpdate: function() {},
    enqueueReplaceState: function() {},
    enqueueSetState: function() {}
}
  , Ku = Object.assign
  , Eu = {};
function An(A, e, t) {
    this.props = A,
    this.context = e,
    this.refs = Eu,
    this.updater = t || Ju
}
An.prototype.isReactComponent = {};
An.prototype.setState = function(A, e) {
    if (typeof A != "object" && typeof A != "function" && A != null)
        throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
    this.updater.enqueueSetState(this, A, e, "setState")
}
;
An.prototype.forceUpdate = function(A) {
    this.updater.enqueueForceUpdate(this, A, "forceUpdate")
}
;
function Fu() {}
Fu.prototype = An.prototype;
function la(A, e, t) {
    this.props = A,
    this.context = e,
    this.refs = Eu,
    this.updater = t || Ju
}
var ia = la.prototype = new Fu;
ia.constructor = la;
Ku(ia, An.prototype);
ia.isPureReactComponent = !0;
var Vo = Array.isArray
  , Cu = Object.prototype.hasOwnProperty
  , aa = {
    current: null
}
  , Gu = {
    key: !0,
    ref: !0,
    __self: !0,
    __source: !0
};
function Iu(A, e, t) {
    var n, r = {}, l = null, a = null;
    if (e != null)
        for (n in e.ref !== void 0 && (a = e.ref),
        e.key !== void 0 && (l = "" + e.key),
        e)
            Cu.call(e, n) && !Gu.hasOwnProperty(n) && (r[n] = e[n]);
    var u = arguments.length - 2;
    if (u === 1)
        r.children = t;
    else if (1 < u) {
        for (var s = Array(u), y = 0; y < u; y++)
            s[y] = arguments[y + 2];
        r.children = s
    }
    if (A && A.defaultProps)
        for (n in u = A.defaultProps,
        u)
            r[n] === void 0 && (r[n] = u[n]);
    return {
        $$typeof: _n,
        type: A,
        key: l,
        ref: a,
        props: r,
        _owner: aa.current
    }
}
function wc(A, e) {
    return {
        $$typeof: _n,
        type: A.type,
        key: e,
        ref: A.ref,
        props: A.props,
        _owner: A._owner
    }
}
function oa(A) {
    return typeof A == "object" && A !== null && A.$$typeof === _n
}
function Uc(A) {
    var e = {
        "=": "=0",
        ":": "=2"
    };
    return "$" + A.replace(/[=:]/g, function(t) {
        return e[t]
    })
}
var Xo = /\/+/g;
function Zl(A, e) {
    return typeof A == "object" && A !== null && A.key != null ? Uc("" + A.key) : e.toString(36)
}
function zr(A, e, t, n, r) {
    var l = typeof A;
    (l === "undefined" || l === "boolean") && (A = null);
    var a = !1;
    if (A === null)
        a = !0;
    else
        switch (l) {
        case "string":
        case "number":
            a = !0;
            break;
        case "object":
            switch (A.$$typeof) {
            case _n:
            case hc:
                a = !0
            }
        }
    if (a)
        return a = A,
        r = r(a),
        A = n === "" ? "." + Zl(a, 0) : n,
        Vo(r) ? (t = "",
        A != null && (t = A.replace(Xo, "$&/") + "/"),
        zr(r, e, t, "", function(y) {
            return y
        })) : r != null && (oa(r) && (r = wc(r, t + (!r.key || a && a.key === r.key ? "" : ("" + r.key).replace(Xo, "$&/") + "/") + A)),
        e.push(r)),
        1;
    if (a = 0,
    n = n === "" ? "." : n + ":",
    Vo(A))
        for (var u = 0; u < A.length; u++) {
            l = A[u];
            var s = n + Zl(l, u);
            a += zr(l, e, t, s, r)
        }
    else if (s = Pc(A),
    typeof s == "function")
        for (A = s.call(A),
        u = 0; !(l = A.next()).done; )
            l = l.value,
            s = n + Zl(l, u++),
            a += zr(l, e, t, s, r);
    else if (l === "object")
        throw e = String(A),
        Error("Objects are not valid as a React child (found: " + (e === "[object Object]" ? "object with keys {" + Object.keys(A).join(", ") + "}" : e) + "). If you meant to render a collection of children, use an array instead.");
    return a
}
function or(A, e, t) {
    if (A == null)
        return A;
    var n = []
      , r = 0;
    return zr(A, n, "", "", function(l) {
        return e.call(t, l, r++)
    }),
    n
}
function Wc(A) {
    if (A._status === -1) {
        var e = A._result;
        e = e(),
        e.then(function(t) {
            (A._status === 0 || A._status === -1) && (A._status = 1,
            A._result = t)
        }, function(t) {
            (A._status === 0 || A._status === -1) && (A._status = 2,
            A._result = t)
        }),
        A._status === -1 && (A._status = 0,
        A._result = e)
    }
    if (A._status === 1)
        return A._result.default;
    throw A._result
}
var OA = {
    current: null
}
  , gr = {
    transition: null
}
  , Zc = {
    ReactCurrentDispatcher: OA,
    ReactCurrentBatchConfig: gr,
    ReactCurrentOwner: aa
};
function Yu() {
    throw Error("act(...) is not supported in production builds of React.")
}
E.Children = {
    map: or,
    forEach: function(A, e, t) {
        or(A, function() {
            e.apply(this, arguments)
        }, t)
    },
    count: function(A) {
        var e = 0;
        return or(A, function() {
            e++
        }),
        e
    },
    toArray: function(A) {
        return or(A, function(e) {
            return e
        }) || []
    },
    only: function(A) {
        if (!oa(A))
            throw Error("React.Children.only expected to receive a single React element child.");
        return A
    }
};
E.Component = An;
E.Fragment = Mc;
E.Profiler = zc;
E.PureComponent = la;
E.StrictMode = bc;
E.Suspense = qc;
E.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = Zc;
E.act = Yu;
E.cloneElement = function(A, e, t) {
    if (A == null)
        throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + A + ".");
    var n = Ku({}, A.props)
      , r = A.key
      , l = A.ref
      , a = A._owner;
    if (e != null) {
        if (e.ref !== void 0 && (l = e.ref,
        a = aa.current),
        e.key !== void 0 && (r = "" + e.key),
        A.type && A.type.defaultProps)
            var u = A.type.defaultProps;
        for (s in e)
            Cu.call(e, s) && !Gu.hasOwnProperty(s) && (n[s] = e[s] === void 0 && u !== void 0 ? u[s] : e[s])
    }
    var s = arguments.length - 2;
    if (s === 1)
        n.children = t;
    else if (1 < s) {
        u = Array(s);
        for (var y = 0; y < s; y++)
            u[y] = arguments[y + 2];
        n.children = u
    }
    return {
        $$typeof: _n,
        type: A.type,
        key: r,
        ref: l,
        props: n,
        _owner: a
    }
}
;
E.createContext = function(A) {
    return A = {
        $$typeof: Vc,
        _currentValue: A,
        _currentValue2: A,
        _threadCount: 0,
        Provider: null,
        Consumer: null,
        _defaultValue: null,
        _globalName: null
    },
    A.Provider = {
        $$typeof: gc,
        _context: A
    },
    A.Consumer = A
}
;
E.createElement = Iu;
E.createFactory = function(A) {
    var e = Iu.bind(null, A);
    return e.type = A,
    e
}
;
E.createRef = function() {
    return {
        current: null
    }
}
;
E.forwardRef = function(A) {
    return {
        $$typeof: Xc,
        render: A
    }
}
;
E.isValidElement = oa;
E.lazy = function(A) {
    return {
        $$typeof: kc,
        _payload: {
            _status: -1,
            _result: A
        },
        _init: Wc
    }
}
;
E.memo = function(A, e) {
    return {
        $$typeof: Oc,
        type: A,
        compare: e === void 0 ? null : e
    }
}
;
E.startTransition = function(A) {
    var e = gr.transition;
    gr.transition = {};
    try {
        A()
    } finally {
        gr.transition = e
    }
}
;
E.unstable_act = Yu;
E.useCallback = function(A, e) {
    return OA.current.useCallback(A, e)
}
;
E.useContext = function(A) {
    return OA.current.useContext(A)
}
;
E.useDebugValue = function() {}
;
E.useDeferredValue = function(A) {
    return OA.current.useDeferredValue(A)
}
;
E.useEffect = function(A, e) {
    return OA.current.useEffect(A, e)
}
;
E.useId = function() {
    return OA.current.useId()
}
;
E.useImperativeHandle = function(A, e, t) {
    return OA.current.useImperativeHandle(A, e, t)
}
;
E.useInsertionEffect = function(A, e) {
    return OA.current.useInsertionEffect(A, e)
}
;
E.useLayoutEffect = function(A, e) {
    return OA.current.useLayoutEffect(A, e)
}
;
E.useMemo = function(A, e) {
    return OA.current.useMemo(A, e)
}
;
E.useReducer = function(A, e, t) {
    return OA.current.useReducer(A, e, t)
}
;
E.useRef = function(A) {
    return OA.current.useRef(A)
}
;
E.useState = function(A) {
    return OA.current.useState(A)
}
;
E.useSyncExternalStore = function(A, e, t) {
    return OA.current.useSyncExternalStore(A, e, t)
}
;
E.useTransition = function() {
    return OA.current.useTransition()
}
;
E.version = "18.3.1";
Hu.exports = E;
var X = Hu.exports;
const Rc = Tc(X);
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Dc = X
  , Hc = Symbol.for("react.element")
  , Jc = Symbol.for("react.fragment")
  , Kc = Object.prototype.hasOwnProperty
  , Ec = Dc.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner
  , Fc = {
    key: !0,
    ref: !0,
    __self: !0,
    __source: !0
};
function Bu(A, e, t) {
    var n, r = {}, l = null, a = null;
    t !== void 0 && (l = "" + t),
    e.key !== void 0 && (l = "" + e.key),
    e.ref !== void 0 && (a = e.ref);
    for (n in e)
        Kc.call(e, n) && !Fc.hasOwnProperty(n) && (r[n] = e[n]);
    if (A && A.defaultProps)
        for (n in e = A.defaultProps,
        e)
            r[n] === void 0 && (r[n] = e[n]);
    return {
        $$typeof: Hc,
        type: A,
        key: l,
        ref: a,
        props: r,
        _owner: Ec.current
    }
}
pl.Fragment = Jc;
pl.jsx = Bu;
pl.jsxs = Bu;
Du.exports = pl;
var i = Du.exports
  , di = {}
  , Qu = {
    exports: {}
}
  , GA = {}
  , _u = {
    exports: {}
}
  , $u = {};
/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
(function(A) {
    function e(g, R) {
        var Z = g.length;
        g.push(R);
        A: for (; 0 < Z; ) {
            var tA = Z - 1 >>> 1
              , cA = g[tA];
            if (0 < r(cA, R))
                g[tA] = R,
                g[Z] = cA,
                Z = tA;
            else
                break A
        }
    }
    function t(g) {
        return g.length === 0 ? null : g[0]
    }
    function n(g) {
        if (g.length === 0)
            return null;
        var R = g[0]
          , Z = g.pop();
        if (Z !== R) {
            g[0] = Z;
            A: for (var tA = 0, cA = g.length, At = cA >>> 1; tA < At; ) {
                var DA = 2 * (tA + 1) - 1
                  , et = g[DA]
                  , BA = DA + 1
                  , tt = g[BA];
                if (0 > r(et, Z))
                    BA < cA && 0 > r(tt, et) ? (g[tA] = tt,
                    g[BA] = Z,
                    tA = BA) : (g[tA] = et,
                    g[DA] = Z,
                    tA = DA);
                else if (BA < cA && 0 > r(tt, Z))
                    g[tA] = tt,
                    g[BA] = Z,
                    tA = BA;
                else
                    break A
            }
        }
        return R
    }
    function r(g, R) {
        var Z = g.sortIndex - R.sortIndex;
        return Z !== 0 ? Z : g.id - R.id
    }
    if (typeof performance == "object" && typeof performance.now == "function") {
        var l = performance;
        A.unstable_now = function() {
            return l.now()
        }
    } else {
        var a = Date
          , u = a.now();
        A.unstable_now = function() {
            return a.now() - u
        }
    }
    var s = []
      , y = []
      , N = 1
      , L = null
      , m = 3
      , h = !1
      , T = !1
      , M = !1
      , J = typeof setTimeout == "function" ? setTimeout : null
      , f = typeof clearTimeout == "function" ? clearTimeout : null
      , p = typeof setImmediate < "u" ? setImmediate : null;
    typeof navigator < "u" && navigator.scheduling !== void 0 && navigator.scheduling.isInputPending !== void 0 && navigator.scheduling.isInputPending.bind(navigator.scheduling);
    function v(g) {
        for (var R = t(y); R !== null; ) {
            if (R.callback === null)
                n(y);
            else if (R.startTime <= g)
                n(y),
                R.sortIndex = R.expirationTime,
                e(s, R);
            else
                break;
            R = t(y)
        }
    }
    function x(g) {
        if (M = !1,
        v(g),
        !T)
            if (t(s) !== null)
                T = !0,
                $e(b);
            else {
                var R = t(y);
                R !== null && rn(x, R.startTime - g)
            }
    }
    function b(g, R) {
        T = !1,
        M && (M = !1,
        f(w),
        w = -1),
        h = !0;
        var Z = m;
        try {
            for (v(R),
            L = t(s); L !== null && (!(L.expirationTime > R) || g && !xA()); ) {
                var tA = L.callback;
                if (typeof tA == "function") {
                    L.callback = null,
                    m = L.priorityLevel;
                    var cA = tA(L.expirationTime <= R);
                    R = A.unstable_now(),
                    typeof cA == "function" ? L.callback = cA : L === t(s) && n(s),
                    v(R)
                } else
                    n(s);
                L = t(s)
            }
            if (L !== null)
                var At = !0;
            else {
                var DA = t(y);
                DA !== null && rn(x, DA.startTime - R),
                At = !1
            }
            return At
        } finally {
            L = null,
            m = Z,
            h = !1
        }
    }
    var O = !1
      , k = null
      , w = -1
      , Y = 5
      , U = -1;
    function xA() {
        return !(A.unstable_now() - U < Y)
    }
    function YA() {
        if (k !== null) {
            var g = A.unstable_now();
            U = g;
            var R = !0;
            try {
                R = k(!0, g)
            } finally {
                R ? Qe() : (O = !1,
                k = null)
            }
        } else
            O = !1
    }
    var Qe;
    if (typeof p == "function")
        Qe = function() {
            p(YA)
        }
        ;
    else if (typeof MessageChannel < "u") {
        var _e = new MessageChannel
          , nn = _e.port2;
        _e.port1.onmessage = YA,
        Qe = function() {
            nn.postMessage(null)
        }
    } else
        Qe = function() {
            J(YA, 0)
        }
        ;
    function $e(g) {
        k = g,
        O || (O = !0,
        Qe())
    }
    function rn(g, R) {
        w = J(function() {
            g(A.unstable_now())
        }, R)
    }
    A.unstable_IdlePriority = 5,
    A.unstable_ImmediatePriority = 1,
    A.unstable_LowPriority = 4,
    A.unstable_NormalPriority = 3,
    A.unstable_Profiling = null,
    A.unstable_UserBlockingPriority = 2,
    A.unstable_cancelCallback = function(g) {
        g.callback = null
    }
    ,
    A.unstable_continueExecution = function() {
        T || h || (T = !0,
        $e(b))
    }
    ,
    A.unstable_forceFrameRate = function(g) {
        0 > g || 125 < g ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : Y = 0 < g ? Math.floor(1e3 / g) : 5
    }
    ,
    A.unstable_getCurrentPriorityLevel = function() {
        return m
    }
    ,
    A.unstable_getFirstCallbackNode = function() {
        return t(s)
    }
    ,
    A.unstable_next = function(g) {
        switch (m) {
        case 1:
        case 2:
        case 3:
            var R = 3;
            break;
        default:
            R = m
        }
        var Z = m;
        m = R;
        try {
            return g()
        } finally {
            m = Z
        }
    }
    ,
    A.unstable_pauseExecution = function() {}
    ,
    A.unstable_requestPaint = function() {}
    ,
    A.unstable_runWithPriority = function(g, R) {
        switch (g) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
            break;
        default:
            g = 3
        }
        var Z = m;
        m = g;
        try {
            return R()
        } finally {
            m = Z
        }
    }
    ,
    A.unstable_scheduleCallback = function(g, R, Z) {
        var tA = A.unstable_now();
        switch (typeof Z == "object" && Z !== null ? (Z = Z.delay,
        Z = typeof Z == "number" && 0 < Z ? tA + Z : tA) : Z = tA,
        g) {
        case 1:
            var cA = -1;
            break;
        case 2:
            cA = 250;
            break;
        case 5:
            cA = 1073741823;
            break;
        case 4:
            cA = 1e4;
            break;
        default:
            cA = 5e3
        }
        return cA = Z + cA,
        g = {
            id: N++,
            callback: R,
            priorityLevel: g,
            startTime: Z,
            expirationTime: cA,
            sortIndex: -1
        },
        Z > tA ? (g.sortIndex = Z,
        e(y, g),
        t(s) === null && g === t(y) && (M ? (f(w),
        w = -1) : M = !0,
        rn(x, Z - tA))) : (g.sortIndex = cA,
        e(s, g),
        T || h || (T = !0,
        $e(b))),
        g
    }
    ,
    A.unstable_shouldYield = xA,
    A.unstable_wrapCallback = function(g) {
        var R = m;
        return function() {
            var Z = m;
            m = R;
            try {
                return g.apply(this, arguments)
            } finally {
                m = Z
            }
        }
    }
}
)($u);
_u.exports = $u;
var Cc = _u.exports;
/**
 * @license React
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Gc = X
  , CA = Cc;
function S(A) {
    for (var e = "https://reactjs.org/docs/error-decoder.html?invariant=" + A, t = 1; t < arguments.length; t++)
        e += "&args[]=" + encodeURIComponent(arguments[t]);
    return "Minified React error #" + A + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings."
}
var As = new Set
  , Pn = {};
function Lt(A, e) {
    Gt(A, e),
    Gt(A + "Capture", e)
}
function Gt(A, e) {
    for (Pn[A] = e,
    A = 0; A < e.length; A++)
        As.add(e[A])
}
var he = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u")
  , ci = Object.prototype.hasOwnProperty
  , Ic = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/
  , qo = {}
  , Oo = {};
function Yc(A) {
    return ci.call(Oo, A) ? !0 : ci.call(qo, A) ? !1 : Ic.test(A) ? Oo[A] = !0 : (qo[A] = !0,
    !1)
}
function Bc(A, e, t, n) {
    if (t !== null && t.type === 0)
        return !1;
    switch (typeof e) {
    case "function":
    case "symbol":
        return !0;
    case "boolean":
        return n ? !1 : t !== null ? !t.acceptsBooleans : (A = A.toLowerCase().slice(0, 5),
        A !== "data-" && A !== "aria-");
    default:
        return !1
    }
}
function Qc(A, e, t, n) {
    if (e === null || typeof e > "u" || Bc(A, e, t, n))
        return !0;
    if (n)
        return !1;
    if (t !== null)
        switch (t.type) {
        case 3:
            return !e;
        case 4:
            return e === !1;
        case 5:
            return isNaN(e);
        case 6:
            return isNaN(e) || 1 > e
        }
    return !1
}
function kA(A, e, t, n, r, l, a) {
    this.acceptsBooleans = e === 2 || e === 3 || e === 4,
    this.attributeName = n,
    this.attributeNamespace = r,
    this.mustUseProperty = t,
    this.propertyName = A,
    this.type = e,
    this.sanitizeURL = l,
    this.removeEmptyString = a
}
var MA = {};
"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(A) {
    MA[A] = new kA(A,0,!1,A,null,!1,!1)
});
[["acceptCharset", "accept-charset"], ["className", "class"], ["htmlFor", "for"], ["httpEquiv", "http-equiv"]].forEach(function(A) {
    var e = A[0];
    MA[e] = new kA(e,1,!1,A[1],null,!1,!1)
});
["contentEditable", "draggable", "spellCheck", "value"].forEach(function(A) {
    MA[A] = new kA(A,2,!1,A.toLowerCase(),null,!1,!1)
});
["autoReverse", "externalResourcesRequired", "focusable", "preserveAlpha"].forEach(function(A) {
    MA[A] = new kA(A,2,!1,A,null,!1,!1)
});
"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(A) {
    MA[A] = new kA(A,3,!1,A.toLowerCase(),null,!1,!1)
});
["checked", "multiple", "muted", "selected"].forEach(function(A) {
    MA[A] = new kA(A,3,!0,A,null,!1,!1)
});
["capture", "download"].forEach(function(A) {
    MA[A] = new kA(A,4,!1,A,null,!1,!1)
});
["cols", "rows", "size", "span"].forEach(function(A) {
    MA[A] = new kA(A,6,!1,A,null,!1,!1)
});
["rowSpan", "start"].forEach(function(A) {
    MA[A] = new kA(A,5,!1,A.toLowerCase(),null,!1,!1)
});
var ua = /[\-:]([a-z])/g;
function sa(A) {
    return A[1].toUpperCase()
}
"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(A) {
    var e = A.replace(ua, sa);
    MA[e] = new kA(e,1,!1,A,null,!1,!1)
});
"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(A) {
    var e = A.replace(ua, sa);
    MA[e] = new kA(e,1,!1,A,"http://www.w3.org/1999/xlink",!1,!1)
});
["xml:base", "xml:lang", "xml:space"].forEach(function(A) {
    var e = A.replace(ua, sa);
    MA[e] = new kA(e,1,!1,A,"http://www.w3.org/XML/1998/namespace",!1,!1)
});
["tabIndex", "crossOrigin"].forEach(function(A) {
    MA[A] = new kA(A,1,!1,A.toLowerCase(),null,!1,!1)
});
MA.xlinkHref = new kA("xlinkHref",1,!1,"xlink:href","http://www.w3.org/1999/xlink",!0,!1);
["src", "href", "action", "formAction"].forEach(function(A) {
    MA[A] = new kA(A,1,!1,A.toLowerCase(),null,!0,!0)
});
function da(A, e, t, n) {
    var r = MA.hasOwnProperty(e) ? MA[e] : null;
    (r !== null ? r.type !== 0 : n || !(2 < e.length) || e[0] !== "o" && e[0] !== "O" || e[1] !== "n" && e[1] !== "N") && (Qc(e, t, r, n) && (t = null),
    n || r === null ? Yc(e) && (t === null ? A.removeAttribute(e) : A.setAttribute(e, "" + t)) : r.mustUseProperty ? A[r.propertyName] = t === null ? r.type === 3 ? !1 : "" : t : (e = r.attributeName,
    n = r.attributeNamespace,
    t === null ? A.removeAttribute(e) : (r = r.type,
    t = r === 3 || r === 4 && t === !0 ? "" : "" + t,
    n ? A.setAttributeNS(n, e, t) : A.setAttribute(e, t))))
}
var ge = Gc.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
  , ur = Symbol.for("react.element")
  , Vt = Symbol.for("react.portal")
  , Xt = Symbol.for("react.fragment")
  , ca = Symbol.for("react.strict_mode")
  , fi = Symbol.for("react.profiler")
  , es = Symbol.for("react.provider")
  , ts = Symbol.for("react.context")
  , fa = Symbol.for("react.forward_ref")
  , pi = Symbol.for("react.suspense")
  , yi = Symbol.for("react.suspense_list")
  , pa = Symbol.for("react.memo")
  , Oe = Symbol.for("react.lazy")
  , ns = Symbol.for("react.offscreen")
  , ko = Symbol.iterator;
function sn(A) {
    return A === null || typeof A != "object" ? null : (A = ko && A[ko] || A["@@iterator"],
    typeof A == "function" ? A : null)
}
var aA = Object.assign, Rl;
function xn(A) {
    if (Rl === void 0)
        try {
            throw Error()
        } catch (t) {
            var e = t.stack.trim().match(/\n( *(at )?)/);
            Rl = e && e[1] || ""
        }
    return `
` + Rl + A
}
var Dl = !1;
function Hl(A, e) {
    if (!A || Dl)
        return "";
    Dl = !0;
    var t = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
        if (e)
            if (e = function() {
                throw Error()
            }
            ,
            Object.defineProperty(e.prototype, "props", {
                set: function() {
                    throw Error()
                }
            }),
            typeof Reflect == "object" && Reflect.construct) {
                try {
                    Reflect.construct(e, [])
                } catch (y) {
                    var n = y
                }
                Reflect.construct(A, [], e)
            } else {
                try {
                    e.call()
                } catch (y) {
                    n = y
                }
                A.call(e.prototype)
            }
        else {
            try {
                throw Error()
            } catch (y) {
                n = y
            }
            A()
        }
    } catch (y) {
        if (y && n && typeof y.stack == "string") {
            for (var r = y.stack.split(`
`), l = n.stack.split(`
`), a = r.length - 1, u = l.length - 1; 1 <= a && 0 <= u && r[a] !== l[u]; )
                u--;
            for (; 1 <= a && 0 <= u; a--,
            u--)
                if (r[a] !== l[u]) {
                    if (a !== 1 || u !== 1)
                        do
                            if (a--,
                            u--,
                            0 > u || r[a] !== l[u]) {
                                var s = `
` + r[a].replace(" at new ", " at ");
                                return A.displayName && s.includes("<anonymous>") && (s = s.replace("<anonymous>", A.displayName)),
                                s
                            }
                        while (1 <= a && 0 <= u);
                    break
                }
        }
    } finally {
        Dl = !1,
        Error.prepareStackTrace = t
    }
    return (A = A ? A.displayName || A.name : "") ? xn(A) : ""
}
function _c(A) {
    switch (A.tag) {
    case 5:
        return xn(A.type);
    case 16:
        return xn("Lazy");
    case 13:
        return xn("Suspense");
    case 19:
        return xn("SuspenseList");
    case 0:
    case 2:
    case 15:
        return A = Hl(A.type, !1),
        A;
    case 11:
        return A = Hl(A.type.render, !1),
        A;
    case 1:
        return A = Hl(A.type, !0),
        A;
    default:
        return ""
    }
}
function vi(A) {
    if (A == null)
        return null;
    if (typeof A == "function")
        return A.displayName || A.name || null;
    if (typeof A == "string")
        return A;
    switch (A) {
    case Xt:
        return "Fragment";
    case Vt:
        return "Portal";
    case fi:
        return "Profiler";
    case ca:
        return "StrictMode";
    case pi:
        return "Suspense";
    case yi:
        return "SuspenseList"
    }
    if (typeof A == "object")
        switch (A.$$typeof) {
        case ts:
            return (A.displayName || "Context") + ".Consumer";
        case es:
            return (A._context.displayName || "Context") + ".Provider";
        case fa:
            var e = A.render;
            return A = A.displayName,
            A || (A = e.displayName || e.name || "",
            A = A !== "" ? "ForwardRef(" + A + ")" : "ForwardRef"),
            A;
        case pa:
            return e = A.displayName || null,
            e !== null ? e : vi(A.type) || "Memo";
        case Oe:
            e = A._payload,
            A = A._init;
            try {
                return vi(A(e))
            } catch {}
        }
    return null
}
function $c(A) {
    var e = A.type;
    switch (A.tag) {
    case 24:
        return "Cache";
    case 9:
        return (e.displayName || "Context") + ".Consumer";
    case 10:
        return (e._context.displayName || "Context") + ".Provider";
    case 18:
        return "DehydratedFragment";
    case 11:
        return A = e.render,
        A = A.displayName || A.name || "",
        e.displayName || (A !== "" ? "ForwardRef(" + A + ")" : "ForwardRef");
    case 7:
        return "Fragment";
    case 5:
        return e;
    case 4:
        return "Portal";
    case 3:
        return "Root";
    case 6:
        return "Text";
    case 16:
        return vi(e);
    case 8:
        return e === ca ? "StrictMode" : "Mode";
    case 22:
        return "Offscreen";
    case 12:
        return "Profiler";
    case 21:
        return "Scope";
    case 13:
        return "Suspense";
    case 19:
        return "SuspenseList";
    case 25:
        return "TracingMarker";
    case 1:
    case 0:
    case 17:
    case 2:
    case 14:
    case 15:
        if (typeof e == "function")
            return e.displayName || e.name || null;
        if (typeof e == "string")
            return e
    }
    return null
}
function Ce(A) {
    switch (typeof A) {
    case "boolean":
    case "number":
    case "string":
    case "undefined":
        return A;
    case "object":
        return A;
    default:
        return ""
    }
}
function rs(A) {
    var e = A.type;
    return (A = A.nodeName) && A.toLowerCase() === "input" && (e === "checkbox" || e === "radio")
}
function Af(A) {
    var e = rs(A) ? "checked" : "value"
      , t = Object.getOwnPropertyDescriptor(A.constructor.prototype, e)
      , n = "" + A[e];
    if (!A.hasOwnProperty(e) && typeof t < "u" && typeof t.get == "function" && typeof t.set == "function") {
        var r = t.get
          , l = t.set;
        return Object.defineProperty(A, e, {
            configurable: !0,
            get: function() {
                return r.call(this)
            },
            set: function(a) {
                n = "" + a,
                l.call(this, a)
            }
        }),
        Object.defineProperty(A, e, {
            enumerable: t.enumerable
        }),
        {
            getValue: function() {
                return n
            },
            setValue: function(a) {
                n = "" + a
            },
            stopTracking: function() {
                A._valueTracker = null,
                delete A[e]
            }
        }
    }
}
function sr(A) {
    A._valueTracker || (A._valueTracker = Af(A))
}
function ls(A) {
    if (!A)
        return !1;
    var e = A._valueTracker;
    if (!e)
        return !0;
    var t = e.getValue()
      , n = "";
    return A && (n = rs(A) ? A.checked ? "true" : "false" : A.value),
    A = n,
    A !== t ? (e.setValue(A),
    !0) : !1
}
function Dr(A) {
    if (A = A || (typeof document < "u" ? document : void 0),
    typeof A > "u")
        return null;
    try {
        return A.activeElement || A.body
    } catch {
        return A.body
    }
}
function mi(A, e) {
    var t = e.checked;
    return aA({}, e, {
        defaultChecked: void 0,
        defaultValue: void 0,
        value: void 0,
        checked: t ?? A._wrapperState.initialChecked
    })
}
function Po(A, e) {
    var t = e.defaultValue == null ? "" : e.defaultValue
      , n = e.checked != null ? e.checked : e.defaultChecked;
    t = Ce(e.value != null ? e.value : t),
    A._wrapperState = {
        initialChecked: n,
        initialValue: t,
        controlled: e.type === "checkbox" || e.type === "radio" ? e.checked != null : e.value != null
    }
}
function is(A, e) {
    e = e.checked,
    e != null && da(A, "checked", e, !1)
}
function Li(A, e) {
    is(A, e);
    var t = Ce(e.value)
      , n = e.type;
    if (t != null)
        n === "number" ? (t === 0 && A.value === "" || A.value != t) && (A.value = "" + t) : A.value !== "" + t && (A.value = "" + t);
    else if (n === "submit" || n === "reset") {
        A.removeAttribute("value");
        return
    }
    e.hasOwnProperty("value") ? xi(A, e.type, t) : e.hasOwnProperty("defaultValue") && xi(A, e.type, Ce(e.defaultValue)),
    e.checked == null && e.defaultChecked != null && (A.defaultChecked = !!e.defaultChecked)
}
function wo(A, e, t) {
    if (e.hasOwnProperty("value") || e.hasOwnProperty("defaultValue")) {
        var n = e.type;
        if (!(n !== "submit" && n !== "reset" || e.value !== void 0 && e.value !== null))
            return;
        e = "" + A._wrapperState.initialValue,
        t || e === A.value || (A.value = e),
        A.defaultValue = e
    }
    t = A.name,
    t !== "" && (A.name = ""),
    A.defaultChecked = !!A._wrapperState.initialChecked,
    t !== "" && (A.name = t)
}
function xi(A, e, t) {
    (e !== "number" || Dr(A.ownerDocument) !== A) && (t == null ? A.defaultValue = "" + A._wrapperState.initialValue : A.defaultValue !== "" + t && (A.defaultValue = "" + t))
}
var jn = Array.isArray;
function Ht(A, e, t, n) {
    if (A = A.options,
    e) {
        e = {};
        for (var r = 0; r < t.length; r++)
            e["$" + t[r]] = !0;
        for (t = 0; t < A.length; t++)
            r = e.hasOwnProperty("$" + A[t].value),
            A[t].selected !== r && (A[t].selected = r),
            r && n && (A[t].defaultSelected = !0)
    } else {
        for (t = "" + Ce(t),
        e = null,
        r = 0; r < A.length; r++) {
            if (A[r].value === t) {
                A[r].selected = !0,
                n && (A[r].defaultSelected = !0);
                return
            }
            e !== null || A[r].disabled || (e = A[r])
        }
        e !== null && (e.selected = !0)
    }
}
function ji(A, e) {
    if (e.dangerouslySetInnerHTML != null)
        throw Error(S(91));
    return aA({}, e, {
        value: void 0,
        defaultValue: void 0,
        children: "" + A._wrapperState.initialValue
    })
}
function Uo(A, e) {
    var t = e.value;
    if (t == null) {
        if (t = e.children,
        e = e.defaultValue,
        t != null) {
            if (e != null)
                throw Error(S(92));
            if (jn(t)) {
                if (1 < t.length)
                    throw Error(S(93));
                t = t[0]
            }
            e = t
        }
        e == null && (e = ""),
        t = e
    }
    A._wrapperState = {
        initialValue: Ce(t)
    }
}
function as(A, e) {
    var t = Ce(e.value)
      , n = Ce(e.defaultValue);
    t != null && (t = "" + t,
    t !== A.value && (A.value = t),
    e.defaultValue == null && A.defaultValue !== t && (A.defaultValue = t)),
    n != null && (A.defaultValue = "" + n)
}
function Wo(A) {
    var e = A.textContent;
    e === A._wrapperState.initialValue && e !== "" && e !== null && (A.value = e)
}
function os(A) {
    switch (A) {
    case "svg":
        return "http://www.w3.org/2000/svg";
    case "math":
        return "http://www.w3.org/1998/Math/MathML";
    default:
        return "http://www.w3.org/1999/xhtml"
    }
}
function Ni(A, e) {
    return A == null || A === "http://www.w3.org/1999/xhtml" ? os(e) : A === "http://www.w3.org/2000/svg" && e === "foreignObject" ? "http://www.w3.org/1999/xhtml" : A
}
var dr, us = function(A) {
    return typeof MSApp < "u" && MSApp.execUnsafeLocalFunction ? function(e, t, n, r) {
        MSApp.execUnsafeLocalFunction(function() {
            return A(e, t, n, r)
        })
    }
    : A
}(function(A, e) {
    if (A.namespaceURI !== "http://www.w3.org/2000/svg" || "innerHTML"in A)
        A.innerHTML = e;
    else {
        for (dr = dr || document.createElement("div"),
        dr.innerHTML = "<svg>" + e.valueOf().toString() + "</svg>",
        e = dr.firstChild; A.firstChild; )
            A.removeChild(A.firstChild);
        for (; e.firstChild; )
            A.appendChild(e.firstChild)
    }
});
function wn(A, e) {
    if (e) {
        var t = A.firstChild;
        if (t && t === A.lastChild && t.nodeType === 3) {
            t.nodeValue = e;
            return
        }
    }
    A.textContent = e
}
var Mn = {
    animationIterationCount: !0,
    aspectRatio: !0,
    borderImageOutset: !0,
    borderImageSlice: !0,
    borderImageWidth: !0,
    boxFlex: !0,
    boxFlexGroup: !0,
    boxOrdinalGroup: !0,
    columnCount: !0,
    columns: !0,
    flex: !0,
    flexGrow: !0,
    flexPositive: !0,
    flexShrink: !0,
    flexNegative: !0,
    flexOrder: !0,
    gridArea: !0,
    gridRow: !0,
    gridRowEnd: !0,
    gridRowSpan: !0,
    gridRowStart: !0,
    gridColumn: !0,
    gridColumnEnd: !0,
    gridColumnSpan: !0,
    gridColumnStart: !0,
    fontWeight: !0,
    lineClamp: !0,
    lineHeight: !0,
    opacity: !0,
    order: !0,
    orphans: !0,
    tabSize: !0,
    widows: !0,
    zIndex: !0,
    zoom: !0,
    fillOpacity: !0,
    floodOpacity: !0,
    stopOpacity: !0,
    strokeDasharray: !0,
    strokeDashoffset: !0,
    strokeMiterlimit: !0,
    strokeOpacity: !0,
    strokeWidth: !0
}
  , ef = ["Webkit", "ms", "Moz", "O"];
Object.keys(Mn).forEach(function(A) {
    ef.forEach(function(e) {
        e = e + A.charAt(0).toUpperCase() + A.substring(1),
        Mn[e] = Mn[A]
    })
});
function ss(A, e, t) {
    return e == null || typeof e == "boolean" || e === "" ? "" : t || typeof e != "number" || e === 0 || Mn.hasOwnProperty(A) && Mn[A] ? ("" + e).trim() : e + "px"
}
function ds(A, e) {
    A = A.style;
    for (var t in e)
        if (e.hasOwnProperty(t)) {
            var n = t.indexOf("--") === 0
              , r = ss(t, e[t], n);
            t === "float" && (t = "cssFloat"),
            n ? A.setProperty(t, r) : A[t] = r
        }
}
var tf = aA({
    menuitem: !0
}, {
    area: !0,
    base: !0,
    br: !0,
    col: !0,
    embed: !0,
    hr: !0,
    img: !0,
    input: !0,
    keygen: !0,
    link: !0,
    meta: !0,
    param: !0,
    source: !0,
    track: !0,
    wbr: !0
});
function Si(A, e) {
    if (e) {
        if (tf[A] && (e.children != null || e.dangerouslySetInnerHTML != null))
            throw Error(S(137, A));
        if (e.dangerouslySetInnerHTML != null) {
            if (e.children != null)
                throw Error(S(60));
            if (typeof e.dangerouslySetInnerHTML != "object" || !("__html"in e.dangerouslySetInnerHTML))
                throw Error(S(61))
        }
        if (e.style != null && typeof e.style != "object")
            throw Error(S(62))
    }
}
function Ti(A, e) {
    if (A.indexOf("-") === -1)
        return typeof e.is == "string";
    switch (A) {
    case "annotation-xml":
    case "color-profile":
    case "font-face":
    case "font-face-src":
    case "font-face-uri":
    case "font-face-format":
    case "font-face-name":
    case "missing-glyph":
        return !1;
    default:
        return !0
    }
}
var hi = null;
function ya(A) {
    return A = A.target || A.srcElement || window,
    A.correspondingUseElement && (A = A.correspondingUseElement),
    A.nodeType === 3 ? A.parentNode : A
}
var Mi = null
  , Jt = null
  , Kt = null;
function Zo(A) {
    if (A = er(A)) {
        if (typeof Mi != "function")
            throw Error(S(280));
        var e = A.stateNode;
        e && (e = xl(e),
        Mi(A.stateNode, A.type, e))
    }
}
function cs(A) {
    Jt ? Kt ? Kt.push(A) : Kt = [A] : Jt = A
}
function fs() {
    if (Jt) {
        var A = Jt
          , e = Kt;
        if (Kt = Jt = null,
        Zo(A),
        e)
            for (A = 0; A < e.length; A++)
                Zo(e[A])
    }
}
function ps(A, e) {
    return A(e)
}
function ys() {}
var Jl = !1;
function vs(A, e, t) {
    if (Jl)
        return A(e, t);
    Jl = !0;
    try {
        return ps(A, e, t)
    } finally {
        Jl = !1,
        (Jt !== null || Kt !== null) && (ys(),
        fs())
    }
}
function Un(A, e) {
    var t = A.stateNode;
    if (t === null)
        return null;
    var n = xl(t);
    if (n === null)
        return null;
    t = n[e];
    A: switch (e) {
    case "onClick":
    case "onClickCapture":
    case "onDoubleClick":
    case "onDoubleClickCapture":
    case "onMouseDown":
    case "onMouseDownCapture":
    case "onMouseMove":
    case "onMouseMoveCapture":
    case "onMouseUp":
    case "onMouseUpCapture":
    case "onMouseEnter":
        (n = !n.disabled) || (A = A.type,
        n = !(A === "button" || A === "input" || A === "select" || A === "textarea")),
        A = !n;
        break A;
    default:
        A = !1
    }
    if (A)
        return null;
    if (t && typeof t != "function")
        throw Error(S(231, e, typeof t));
    return t
}
var bi = !1;
if (he)
    try {
        var dn = {};
        Object.defineProperty(dn, "passive", {
            get: function() {
                bi = !0
            }
        }),
        window.addEventListener("test", dn, dn),
        window.removeEventListener("test", dn, dn)
    } catch {
        bi = !1
    }
function nf(A, e, t, n, r, l, a, u, s) {
    var y = Array.prototype.slice.call(arguments, 3);
    try {
        e.apply(t, y)
    } catch (N) {
        this.onError(N)
    }
}
var bn = !1
  , Hr = null
  , Jr = !1
  , zi = null
  , rf = {
    onError: function(A) {
        bn = !0,
        Hr = A
    }
};
function lf(A, e, t, n, r, l, a, u, s) {
    bn = !1,
    Hr = null,
    nf.apply(rf, arguments)
}
function af(A, e, t, n, r, l, a, u, s) {
    if (lf.apply(this, arguments),
    bn) {
        if (bn) {
            var y = Hr;
            bn = !1,
            Hr = null
        } else
            throw Error(S(198));
        Jr || (Jr = !0,
        zi = y)
    }
}
function xt(A) {
    var e = A
      , t = A;
    if (A.alternate)
        for (; e.return; )
            e = e.return;
    else {
        A = e;
        do
            e = A,
            e.flags & 4098 && (t = e.return),
            A = e.return;
        while (A)
    }
    return e.tag === 3 ? t : null
}
function ms(A) {
    if (A.tag === 13) {
        var e = A.memoizedState;
        if (e === null && (A = A.alternate,
        A !== null && (e = A.memoizedState)),
        e !== null)
            return e.dehydrated
    }
    return null
}
function Ro(A) {
    if (xt(A) !== A)
        throw Error(S(188))
}
function of(A) {
    var e = A.alternate;
    if (!e) {
        if (e = xt(A),
        e === null)
            throw Error(S(188));
        return e !== A ? null : A
    }
    for (var t = A, n = e; ; ) {
        var r = t.return;
        if (r === null)
            break;
        var l = r.alternate;
        if (l === null) {
            if (n = r.return,
            n !== null) {
                t = n;
                continue
            }
            break
        }
        if (r.child === l.child) {
            for (l = r.child; l; ) {
                if (l === t)
                    return Ro(r),
                    A;
                if (l === n)
                    return Ro(r),
                    e;
                l = l.sibling
            }
            throw Error(S(188))
        }
        if (t.return !== n.return)
            t = r,
            n = l;
        else {
            for (var a = !1, u = r.child; u; ) {
                if (u === t) {
                    a = !0,
                    t = r,
                    n = l;
                    break
                }
                if (u === n) {
                    a = !0,
                    n = r,
                    t = l;
                    break
                }
                u = u.sibling
            }
            if (!a) {
                for (u = l.child; u; ) {
                    if (u === t) {
                        a = !0,
                        t = l,
                        n = r;
                        break
                    }
                    if (u === n) {
                        a = !0,
                        n = l,
                        t = r;
                        break
                    }
                    u = u.sibling
                }
                if (!a)
                    throw Error(S(189))
            }
        }
        if (t.alternate !== n)
            throw Error(S(190))
    }
    if (t.tag !== 3)
        throw Error(S(188));
    return t.stateNode.current === t ? A : e
}
function Ls(A) {
    return A = of(A),
    A !== null ? xs(A) : null
}
function xs(A) {
    if (A.tag === 5 || A.tag === 6)
        return A;
    for (A = A.child; A !== null; ) {
        var e = xs(A);
        if (e !== null)
            return e;
        A = A.sibling
    }
    return null
}
var js = CA.unstable_scheduleCallback
  , Do = CA.unstable_cancelCallback
  , uf = CA.unstable_shouldYield
  , sf = CA.unstable_requestPaint
  , uA = CA.unstable_now
  , df = CA.unstable_getCurrentPriorityLevel
  , va = CA.unstable_ImmediatePriority
  , Ns = CA.unstable_UserBlockingPriority
  , Kr = CA.unstable_NormalPriority
  , cf = CA.unstable_LowPriority
  , Ss = CA.unstable_IdlePriority
  , yl = null
  , ye = null;
function ff(A) {
    if (ye && typeof ye.onCommitFiberRoot == "function")
        try {
            ye.onCommitFiberRoot(yl, A, void 0, (A.current.flags & 128) === 128)
        } catch {}
}
var oe = Math.clz32 ? Math.clz32 : vf
  , pf = Math.log
  , yf = Math.LN2;
function vf(A) {
    return A >>>= 0,
    A === 0 ? 32 : 31 - (pf(A) / yf | 0) | 0
}
var cr = 64
  , fr = 4194304;
function Nn(A) {
    switch (A & -A) {
    case 1:
        return 1;
    case 2:
        return 2;
    case 4:
        return 4;
    case 8:
        return 8;
    case 16:
        return 16;
    case 32:
        return 32;
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
        return A & 4194240;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
        return A & 130023424;
    case 134217728:
        return 134217728;
    case 268435456:
        return 268435456;
    case 536870912:
        return 536870912;
    case 1073741824:
        return 1073741824;
    default:
        return A
    }
}
function Er(A, e) {
    var t = A.pendingLanes;
    if (t === 0)
        return 0;
    var n = 0
      , r = A.suspendedLanes
      , l = A.pingedLanes
      , a = t & 268435455;
    if (a !== 0) {
        var u = a & ~r;
        u !== 0 ? n = Nn(u) : (l &= a,
        l !== 0 && (n = Nn(l)))
    } else
        a = t & ~r,
        a !== 0 ? n = Nn(a) : l !== 0 && (n = Nn(l));
    if (n === 0)
        return 0;
    if (e !== 0 && e !== n && !(e & r) && (r = n & -n,
    l = e & -e,
    r >= l || r === 16 && (l & 4194240) !== 0))
        return e;
    if (n & 4 && (n |= t & 16),
    e = A.entangledLanes,
    e !== 0)
        for (A = A.entanglements,
        e &= n; 0 < e; )
            t = 31 - oe(e),
            r = 1 << t,
            n |= A[t],
            e &= ~r;
    return n
}
function mf(A, e) {
    switch (A) {
    case 1:
    case 2:
    case 4:
        return e + 250;
    case 8:
    case 16:
    case 32:
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
        return e + 5e3;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
        return -1;
    case 134217728:
    case 268435456:
    case 536870912:
    case 1073741824:
        return -1;
    default:
        return -1
    }
}
function Lf(A, e) {
    for (var t = A.suspendedLanes, n = A.pingedLanes, r = A.expirationTimes, l = A.pendingLanes; 0 < l; ) {
        var a = 31 - oe(l)
          , u = 1 << a
          , s = r[a];
        s === -1 ? (!(u & t) || u & n) && (r[a] = mf(u, e)) : s <= e && (A.expiredLanes |= u),
        l &= ~u
    }
}
function gi(A) {
    return A = A.pendingLanes & -1073741825,
    A !== 0 ? A : A & 1073741824 ? 1073741824 : 0
}
function Ts() {
    var A = cr;
    return cr <<= 1,
    !(cr & 4194240) && (cr = 64),
    A
}
function Kl(A) {
    for (var e = [], t = 0; 31 > t; t++)
        e.push(A);
    return e
}
function $n(A, e, t) {
    A.pendingLanes |= e,
    e !== 536870912 && (A.suspendedLanes = 0,
    A.pingedLanes = 0),
    A = A.eventTimes,
    e = 31 - oe(e),
    A[e] = t
}
function xf(A, e) {
    var t = A.pendingLanes & ~e;
    A.pendingLanes = e,
    A.suspendedLanes = 0,
    A.pingedLanes = 0,
    A.expiredLanes &= e,
    A.mutableReadLanes &= e,
    A.entangledLanes &= e,
    e = A.entanglements;
    var n = A.eventTimes;
    for (A = A.expirationTimes; 0 < t; ) {
        var r = 31 - oe(t)
          , l = 1 << r;
        e[r] = 0,
        n[r] = -1,
        A[r] = -1,
        t &= ~l
    }
}
function ma(A, e) {
    var t = A.entangledLanes |= e;
    for (A = A.entanglements; t; ) {
        var n = 31 - oe(t)
          , r = 1 << n;
        r & e | A[n] & e && (A[n] |= e),
        t &= ~r
    }
}
var I = 0;
function hs(A) {
    return A &= -A,
    1 < A ? 4 < A ? A & 268435455 ? 16 : 536870912 : 4 : 1
}
var Ms, La, bs, zs, gs, Vi = !1, pr = [], Ze = null, Re = null, De = null, Wn = new Map, Zn = new Map, Pe = [], jf = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
function Ho(A, e) {
    switch (A) {
    case "focusin":
    case "focusout":
        Ze = null;
        break;
    case "dragenter":
    case "dragleave":
        Re = null;
        break;
    case "mouseover":
    case "mouseout":
        De = null;
        break;
    case "pointerover":
    case "pointerout":
        Wn.delete(e.pointerId);
        break;
    case "gotpointercapture":
    case "lostpointercapture":
        Zn.delete(e.pointerId)
    }
}
function cn(A, e, t, n, r, l) {
    return A === null || A.nativeEvent !== l ? (A = {
        blockedOn: e,
        domEventName: t,
        eventSystemFlags: n,
        nativeEvent: l,
        targetContainers: [r]
    },
    e !== null && (e = er(e),
    e !== null && La(e)),
    A) : (A.eventSystemFlags |= n,
    e = A.targetContainers,
    r !== null && e.indexOf(r) === -1 && e.push(r),
    A)
}
function Nf(A, e, t, n, r) {
    switch (e) {
    case "focusin":
        return Ze = cn(Ze, A, e, t, n, r),
        !0;
    case "dragenter":
        return Re = cn(Re, A, e, t, n, r),
        !0;
    case "mouseover":
        return De = cn(De, A, e, t, n, r),
        !0;
    case "pointerover":
        var l = r.pointerId;
        return Wn.set(l, cn(Wn.get(l) || null, A, e, t, n, r)),
        !0;
    case "gotpointercapture":
        return l = r.pointerId,
        Zn.set(l, cn(Zn.get(l) || null, A, e, t, n, r)),
        !0
    }
    return !1
}
function Vs(A) {
    var e = ot(A.target);
    if (e !== null) {
        var t = xt(e);
        if (t !== null) {
            if (e = t.tag,
            e === 13) {
                if (e = ms(t),
                e !== null) {
                    A.blockedOn = e,
                    gs(A.priority, function() {
                        bs(t)
                    });
                    return
                }
            } else if (e === 3 && t.stateNode.current.memoizedState.isDehydrated) {
                A.blockedOn = t.tag === 3 ? t.stateNode.containerInfo : null;
                return
            }
        }
    }
    A.blockedOn = null
}
function Vr(A) {
    if (A.blockedOn !== null)
        return !1;
    for (var e = A.targetContainers; 0 < e.length; ) {
        var t = Xi(A.domEventName, A.eventSystemFlags, e[0], A.nativeEvent);
        if (t === null) {
            t = A.nativeEvent;
            var n = new t.constructor(t.type,t);
            hi = n,
            t.target.dispatchEvent(n),
            hi = null
        } else
            return e = er(t),
            e !== null && La(e),
            A.blockedOn = t,
            !1;
        e.shift()
    }
    return !0
}
function Jo(A, e, t) {
    Vr(A) && t.delete(e)
}
function Sf() {
    Vi = !1,
    Ze !== null && Vr(Ze) && (Ze = null),
    Re !== null && Vr(Re) && (Re = null),
    De !== null && Vr(De) && (De = null),
    Wn.forEach(Jo),
    Zn.forEach(Jo)
}
function fn(A, e) {
    A.blockedOn === e && (A.blockedOn = null,
    Vi || (Vi = !0,
    CA.unstable_scheduleCallback(CA.unstable_NormalPriority, Sf)))
}
function Rn(A) {
    function e(r) {
        return fn(r, A)
    }
    if (0 < pr.length) {
        fn(pr[0], A);
        for (var t = 1; t < pr.length; t++) {
            var n = pr[t];
            n.blockedOn === A && (n.blockedOn = null)
        }
    }
    for (Ze !== null && fn(Ze, A),
    Re !== null && fn(Re, A),
    De !== null && fn(De, A),
    Wn.forEach(e),
    Zn.forEach(e),
    t = 0; t < Pe.length; t++)
        n = Pe[t],
        n.blockedOn === A && (n.blockedOn = null);
    for (; 0 < Pe.length && (t = Pe[0],
    t.blockedOn === null); )
        Vs(t),
        t.blockedOn === null && Pe.shift()
}
var Et = ge.ReactCurrentBatchConfig
  , Fr = !0;
function Tf(A, e, t, n) {
    var r = I
      , l = Et.transition;
    Et.transition = null;
    try {
        I = 1,
        xa(A, e, t, n)
    } finally {
        I = r,
        Et.transition = l
    }
}
function hf(A, e, t, n) {
    var r = I
      , l = Et.transition;
    Et.transition = null;
    try {
        I = 4,
        xa(A, e, t, n)
    } finally {
        I = r,
        Et.transition = l
    }
}
function xa(A, e, t, n) {
    if (Fr) {
        var r = Xi(A, e, t, n);
        if (r === null)
            $l(A, e, n, Cr, t),
            Ho(A, n);
        else if (Nf(r, A, e, t, n))
            n.stopPropagation();
        else if (Ho(A, n),
        e & 4 && -1 < jf.indexOf(A)) {
            for (; r !== null; ) {
                var l = er(r);
                if (l !== null && Ms(l),
                l = Xi(A, e, t, n),
                l === null && $l(A, e, n, Cr, t),
                l === r)
                    break;
                r = l
            }
            r !== null && n.stopPropagation()
        } else
            $l(A, e, n, null, t)
    }
}
var Cr = null;
function Xi(A, e, t, n) {
    if (Cr = null,
    A = ya(n),
    A = ot(A),
    A !== null)
        if (e = xt(A),
        e === null)
            A = null;
        else if (t = e.tag,
        t === 13) {
            if (A = ms(e),
            A !== null)
                return A;
            A = null
        } else if (t === 3) {
            if (e.stateNode.current.memoizedState.isDehydrated)
                return e.tag === 3 ? e.stateNode.containerInfo : null;
            A = null
        } else
            e !== A && (A = null);
    return Cr = A,
    null
}
function Xs(A) {
    switch (A) {
    case "cancel":
    case "click":
    case "close":
    case "contextmenu":
    case "copy":
    case "cut":
    case "auxclick":
    case "dblclick":
    case "dragend":
    case "dragstart":
    case "drop":
    case "focusin":
    case "focusout":
    case "input":
    case "invalid":
    case "keydown":
    case "keypress":
    case "keyup":
    case "mousedown":
    case "mouseup":
    case "paste":
    case "pause":
    case "play":
    case "pointercancel":
    case "pointerdown":
    case "pointerup":
    case "ratechange":
    case "reset":
    case "resize":
    case "seeked":
    case "submit":
    case "touchcancel":
    case "touchend":
    case "touchstart":
    case "volumechange":
    case "change":
    case "selectionchange":
    case "textInput":
    case "compositionstart":
    case "compositionend":
    case "compositionupdate":
    case "beforeblur":
    case "afterblur":
    case "beforeinput":
    case "blur":
    case "fullscreenchange":
    case "focus":
    case "hashchange":
    case "popstate":
    case "select":
    case "selectstart":
        return 1;
    case "drag":
    case "dragenter":
    case "dragexit":
    case "dragleave":
    case "dragover":
    case "mousemove":
    case "mouseout":
    case "mouseover":
    case "pointermove":
    case "pointerout":
    case "pointerover":
    case "scroll":
    case "toggle":
    case "touchmove":
    case "wheel":
    case "mouseenter":
    case "mouseleave":
    case "pointerenter":
    case "pointerleave":
        return 4;
    case "message":
        switch (df()) {
        case va:
            return 1;
        case Ns:
            return 4;
        case Kr:
        case cf:
            return 16;
        case Ss:
            return 536870912;
        default:
            return 16
        }
    default:
        return 16
    }
}
var Ue = null
  , ja = null
  , Xr = null;
function qs() {
    if (Xr)
        return Xr;
    var A, e = ja, t = e.length, n, r = "value"in Ue ? Ue.value : Ue.textContent, l = r.length;
    for (A = 0; A < t && e[A] === r[A]; A++)
        ;
    var a = t - A;
    for (n = 1; n <= a && e[t - n] === r[l - n]; n++)
        ;
    return Xr = r.slice(A, 1 < n ? 1 - n : void 0)
}
function qr(A) {
    var e = A.keyCode;
    return "charCode"in A ? (A = A.charCode,
    A === 0 && e === 13 && (A = 13)) : A = e,
    A === 10 && (A = 13),
    32 <= A || A === 13 ? A : 0
}
function yr() {
    return !0
}
function Ko() {
    return !1
}
function IA(A) {
    function e(t, n, r, l, a) {
        this._reactName = t,
        this._targetInst = r,
        this.type = n,
        this.nativeEvent = l,
        this.target = a,
        this.currentTarget = null;
        for (var u in A)
            A.hasOwnProperty(u) && (t = A[u],
            this[u] = t ? t(l) : l[u]);
        return this.isDefaultPrevented = (l.defaultPrevented != null ? l.defaultPrevented : l.returnValue === !1) ? yr : Ko,
        this.isPropagationStopped = Ko,
        this
    }
    return aA(e.prototype, {
        preventDefault: function() {
            this.defaultPrevented = !0;
            var t = this.nativeEvent;
            t && (t.preventDefault ? t.preventDefault() : typeof t.returnValue != "unknown" && (t.returnValue = !1),
            this.isDefaultPrevented = yr)
        },
        stopPropagation: function() {
            var t = this.nativeEvent;
            t && (t.stopPropagation ? t.stopPropagation() : typeof t.cancelBubble != "unknown" && (t.cancelBubble = !0),
            this.isPropagationStopped = yr)
        },
        persist: function() {},
        isPersistent: yr
    }),
    e
}
var en = {
    eventPhase: 0,
    bubbles: 0,
    cancelable: 0,
    timeStamp: function(A) {
        return A.timeStamp || Date.now()
    },
    defaultPrevented: 0,
    isTrusted: 0
}, Na = IA(en), Ar = aA({}, en, {
    view: 0,
    detail: 0
}), Mf = IA(Ar), El, Fl, pn, vl = aA({}, Ar, {
    screenX: 0,
    screenY: 0,
    clientX: 0,
    clientY: 0,
    pageX: 0,
    pageY: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    getModifierState: Sa,
    button: 0,
    buttons: 0,
    relatedTarget: function(A) {
        return A.relatedTarget === void 0 ? A.fromElement === A.srcElement ? A.toElement : A.fromElement : A.relatedTarget
    },
    movementX: function(A) {
        return "movementX"in A ? A.movementX : (A !== pn && (pn && A.type === "mousemove" ? (El = A.screenX - pn.screenX,
        Fl = A.screenY - pn.screenY) : Fl = El = 0,
        pn = A),
        El)
    },
    movementY: function(A) {
        return "movementY"in A ? A.movementY : Fl
    }
}), Eo = IA(vl), bf = aA({}, vl, {
    dataTransfer: 0
}), zf = IA(bf), gf = aA({}, Ar, {
    relatedTarget: 0
}), Cl = IA(gf), Vf = aA({}, en, {
    animationName: 0,
    elapsedTime: 0,
    pseudoElement: 0
}), Xf = IA(Vf), qf = aA({}, en, {
    clipboardData: function(A) {
        return "clipboardData"in A ? A.clipboardData : window.clipboardData
    }
}), Of = IA(qf), kf = aA({}, en, {
    data: 0
}), Fo = IA(kf), Pf = {
    Esc: "Escape",
    Spacebar: " ",
    Left: "ArrowLeft",
    Up: "ArrowUp",
    Right: "ArrowRight",
    Down: "ArrowDown",
    Del: "Delete",
    Win: "OS",
    Menu: "ContextMenu",
    Apps: "ContextMenu",
    Scroll: "ScrollLock",
    MozPrintableKey: "Unidentified"
}, wf = {
    8: "Backspace",
    9: "Tab",
    12: "Clear",
    13: "Enter",
    16: "Shift",
    17: "Control",
    18: "Alt",
    19: "Pause",
    20: "CapsLock",
    27: "Escape",
    32: " ",
    33: "PageUp",
    34: "PageDown",
    35: "End",
    36: "Home",
    37: "ArrowLeft",
    38: "ArrowUp",
    39: "ArrowRight",
    40: "ArrowDown",
    45: "Insert",
    46: "Delete",
    112: "F1",
    113: "F2",
    114: "F3",
    115: "F4",
    116: "F5",
    117: "F6",
    118: "F7",
    119: "F8",
    120: "F9",
    121: "F10",
    122: "F11",
    123: "F12",
    144: "NumLock",
    145: "ScrollLock",
    224: "Meta"
}, Uf = {
    Alt: "altKey",
    Control: "ctrlKey",
    Meta: "metaKey",
    Shift: "shiftKey"
};
function Wf(A) {
    var e = this.nativeEvent;
    return e.getModifierState ? e.getModifierState(A) : (A = Uf[A]) ? !!e[A] : !1
}
function Sa() {
    return Wf
}
var Zf = aA({}, Ar, {
    key: function(A) {
        if (A.key) {
            var e = Pf[A.key] || A.key;
            if (e !== "Unidentified")
                return e
        }
        return A.type === "keypress" ? (A = qr(A),
        A === 13 ? "Enter" : String.fromCharCode(A)) : A.type === "keydown" || A.type === "keyup" ? wf[A.keyCode] || "Unidentified" : ""
    },
    code: 0,
    location: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    repeat: 0,
    locale: 0,
    getModifierState: Sa,
    charCode: function(A) {
        return A.type === "keypress" ? qr(A) : 0
    },
    keyCode: function(A) {
        return A.type === "keydown" || A.type === "keyup" ? A.keyCode : 0
    },
    which: function(A) {
        return A.type === "keypress" ? qr(A) : A.type === "keydown" || A.type === "keyup" ? A.keyCode : 0
    }
})
  , Rf = IA(Zf)
  , Df = aA({}, vl, {
    pointerId: 0,
    width: 0,
    height: 0,
    pressure: 0,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    pointerType: 0,
    isPrimary: 0
})
  , Co = IA(Df)
  , Hf = aA({}, Ar, {
    touches: 0,
    targetTouches: 0,
    changedTouches: 0,
    altKey: 0,
    metaKey: 0,
    ctrlKey: 0,
    shiftKey: 0,
    getModifierState: Sa
})
  , Jf = IA(Hf)
  , Kf = aA({}, en, {
    propertyName: 0,
    elapsedTime: 0,
    pseudoElement: 0
})
  , Ef = IA(Kf)
  , Ff = aA({}, vl, {
    deltaX: function(A) {
        return "deltaX"in A ? A.deltaX : "wheelDeltaX"in A ? -A.wheelDeltaX : 0
    },
    deltaY: function(A) {
        return "deltaY"in A ? A.deltaY : "wheelDeltaY"in A ? -A.wheelDeltaY : "wheelDelta"in A ? -A.wheelDelta : 0
    },
    deltaZ: 0,
    deltaMode: 0
})
  , Cf = IA(Ff)
  , Gf = [9, 13, 27, 32]
  , Ta = he && "CompositionEvent"in window
  , zn = null;
he && "documentMode"in document && (zn = document.documentMode);
var If = he && "TextEvent"in window && !zn
  , Os = he && (!Ta || zn && 8 < zn && 11 >= zn)
  , Go = " "
  , Io = !1;
function ks(A, e) {
    switch (A) {
    case "keyup":
        return Gf.indexOf(e.keyCode) !== -1;
    case "keydown":
        return e.keyCode !== 229;
    case "keypress":
    case "mousedown":
    case "focusout":
        return !0;
    default:
        return !1
    }
}
function Ps(A) {
    return A = A.detail,
    typeof A == "object" && "data"in A ? A.data : null
}
var qt = !1;
function Yf(A, e) {
    switch (A) {
    case "compositionend":
        return Ps(e);
    case "keypress":
        return e.which !== 32 ? null : (Io = !0,
        Go);
    case "textInput":
        return A = e.data,
        A === Go && Io ? null : A;
    default:
        return null
    }
}
function Bf(A, e) {
    if (qt)
        return A === "compositionend" || !Ta && ks(A, e) ? (A = qs(),
        Xr = ja = Ue = null,
        qt = !1,
        A) : null;
    switch (A) {
    case "paste":
        return null;
    case "keypress":
        if (!(e.ctrlKey || e.altKey || e.metaKey) || e.ctrlKey && e.altKey) {
            if (e.char && 1 < e.char.length)
                return e.char;
            if (e.which)
                return String.fromCharCode(e.which)
        }
        return null;
    case "compositionend":
        return Os && e.locale !== "ko" ? null : e.data;
    default:
        return null
    }
}
var Qf = {
    color: !0,
    date: !0,
    datetime: !0,
    "datetime-local": !0,
    email: !0,
    month: !0,
    number: !0,
    password: !0,
    range: !0,
    search: !0,
    tel: !0,
    text: !0,
    time: !0,
    url: !0,
    week: !0
};
function Yo(A) {
    var e = A && A.nodeName && A.nodeName.toLowerCase();
    return e === "input" ? !!Qf[A.type] : e === "textarea"
}
function ws(A, e, t, n) {
    cs(n),
    e = Gr(e, "onChange"),
    0 < e.length && (t = new Na("onChange","change",null,t,n),
    A.push({
        event: t,
        listeners: e
    }))
}
var gn = null
  , Dn = null;
function _f(A) {
    Cs(A, 0)
}
function ml(A) {
    var e = Pt(A);
    if (ls(e))
        return A
}
function $f(A, e) {
    if (A === "change")
        return e
}
var Us = !1;
if (he) {
    var Gl;
    if (he) {
        var Il = "oninput"in document;
        if (!Il) {
            var Bo = document.createElement("div");
            Bo.setAttribute("oninput", "return;"),
            Il = typeof Bo.oninput == "function"
        }
        Gl = Il
    } else
        Gl = !1;
    Us = Gl && (!document.documentMode || 9 < document.documentMode)
}
function Qo() {
    gn && (gn.detachEvent("onpropertychange", Ws),
    Dn = gn = null)
}
function Ws(A) {
    if (A.propertyName === "value" && ml(Dn)) {
        var e = [];
        ws(e, Dn, A, ya(A)),
        vs(_f, e)
    }
}
function Ap(A, e, t) {
    A === "focusin" ? (Qo(),
    gn = e,
    Dn = t,
    gn.attachEvent("onpropertychange", Ws)) : A === "focusout" && Qo()
}
function ep(A) {
    if (A === "selectionchange" || A === "keyup" || A === "keydown")
        return ml(Dn)
}
function tp(A, e) {
    if (A === "click")
        return ml(e)
}
function np(A, e) {
    if (A === "input" || A === "change")
        return ml(e)
}
function rp(A, e) {
    return A === e && (A !== 0 || 1 / A === 1 / e) || A !== A && e !== e
}
var se = typeof Object.is == "function" ? Object.is : rp;
function Hn(A, e) {
    if (se(A, e))
        return !0;
    if (typeof A != "object" || A === null || typeof e != "object" || e === null)
        return !1;
    var t = Object.keys(A)
      , n = Object.keys(e);
    if (t.length !== n.length)
        return !1;
    for (n = 0; n < t.length; n++) {
        var r = t[n];
        if (!ci.call(e, r) || !se(A[r], e[r]))
            return !1
    }
    return !0
}
function _o(A) {
    for (; A && A.firstChild; )
        A = A.firstChild;
    return A
}
function $o(A, e) {
    var t = _o(A);
    A = 0;
    for (var n; t; ) {
        if (t.nodeType === 3) {
            if (n = A + t.textContent.length,
            A <= e && n >= e)
                return {
                    node: t,
                    offset: e - A
                };
            A = n
        }
        A: {
            for (; t; ) {
                if (t.nextSibling) {
                    t = t.nextSibling;
                    break A
                }
                t = t.parentNode
            }
            t = void 0
        }
        t = _o(t)
    }
}
function Zs(A, e) {
    return A && e ? A === e ? !0 : A && A.nodeType === 3 ? !1 : e && e.nodeType === 3 ? Zs(A, e.parentNode) : "contains"in A ? A.contains(e) : A.compareDocumentPosition ? !!(A.compareDocumentPosition(e) & 16) : !1 : !1
}
function Rs() {
    for (var A = window, e = Dr(); e instanceof A.HTMLIFrameElement; ) {
        try {
            var t = typeof e.contentWindow.location.href == "string"
        } catch {
            t = !1
        }
        if (t)
            A = e.contentWindow;
        else
            break;
        e = Dr(A.document)
    }
    return e
}
function ha(A) {
    var e = A && A.nodeName && A.nodeName.toLowerCase();
    return e && (e === "input" && (A.type === "text" || A.type === "search" || A.type === "tel" || A.type === "url" || A.type === "password") || e === "textarea" || A.contentEditable === "true")
}
function lp(A) {
    var e = Rs()
      , t = A.focusedElem
      , n = A.selectionRange;
    if (e !== t && t && t.ownerDocument && Zs(t.ownerDocument.documentElement, t)) {
        if (n !== null && ha(t)) {
            if (e = n.start,
            A = n.end,
            A === void 0 && (A = e),
            "selectionStart"in t)
                t.selectionStart = e,
                t.selectionEnd = Math.min(A, t.value.length);
            else if (A = (e = t.ownerDocument || document) && e.defaultView || window,
            A.getSelection) {
                A = A.getSelection();
                var r = t.textContent.length
                  , l = Math.min(n.start, r);
                n = n.end === void 0 ? l : Math.min(n.end, r),
                !A.extend && l > n && (r = n,
                n = l,
                l = r),
                r = $o(t, l);
                var a = $o(t, n);
                r && a && (A.rangeCount !== 1 || A.anchorNode !== r.node || A.anchorOffset !== r.offset || A.focusNode !== a.node || A.focusOffset !== a.offset) && (e = e.createRange(),
                e.setStart(r.node, r.offset),
                A.removeAllRanges(),
                l > n ? (A.addRange(e),
                A.extend(a.node, a.offset)) : (e.setEnd(a.node, a.offset),
                A.addRange(e)))
            }
        }
        for (e = [],
        A = t; A = A.parentNode; )
            A.nodeType === 1 && e.push({
                element: A,
                left: A.scrollLeft,
                top: A.scrollTop
            });
        for (typeof t.focus == "function" && t.focus(),
        t = 0; t < e.length; t++)
            A = e[t],
            A.element.scrollLeft = A.left,
            A.element.scrollTop = A.top
    }
}
var ip = he && "documentMode"in document && 11 >= document.documentMode
  , Ot = null
  , qi = null
  , Vn = null
  , Oi = !1;
function Au(A, e, t) {
    var n = t.window === t ? t.document : t.nodeType === 9 ? t : t.ownerDocument;
    Oi || Ot == null || Ot !== Dr(n) || (n = Ot,
    "selectionStart"in n && ha(n) ? n = {
        start: n.selectionStart,
        end: n.selectionEnd
    } : (n = (n.ownerDocument && n.ownerDocument.defaultView || window).getSelection(),
    n = {
        anchorNode: n.anchorNode,
        anchorOffset: n.anchorOffset,
        focusNode: n.focusNode,
        focusOffset: n.focusOffset
    }),
    Vn && Hn(Vn, n) || (Vn = n,
    n = Gr(qi, "onSelect"),
    0 < n.length && (e = new Na("onSelect","select",null,e,t),
    A.push({
        event: e,
        listeners: n
    }),
    e.target = Ot)))
}
function vr(A, e) {
    var t = {};
    return t[A.toLowerCase()] = e.toLowerCase(),
    t["Webkit" + A] = "webkit" + e,
    t["Moz" + A] = "moz" + e,
    t
}
var kt = {
    animationend: vr("Animation", "AnimationEnd"),
    animationiteration: vr("Animation", "AnimationIteration"),
    animationstart: vr("Animation", "AnimationStart"),
    transitionend: vr("Transition", "TransitionEnd")
}
  , Yl = {}
  , Ds = {};
he && (Ds = document.createElement("div").style,
"AnimationEvent"in window || (delete kt.animationend.animation,
delete kt.animationiteration.animation,
delete kt.animationstart.animation),
"TransitionEvent"in window || delete kt.transitionend.transition);
function Ll(A) {
    if (Yl[A])
        return Yl[A];
    if (!kt[A])
        return A;
    var e = kt[A], t;
    for (t in e)
        if (e.hasOwnProperty(t) && t in Ds)
            return Yl[A] = e[t];
    return A
}
var Hs = Ll("animationend")
  , Js = Ll("animationiteration")
  , Ks = Ll("animationstart")
  , Es = Ll("transitionend")
  , Fs = new Map
  , eu = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
function Ie(A, e) {
    Fs.set(A, e),
    Lt(e, [A])
}
for (var Bl = 0; Bl < eu.length; Bl++) {
    var Ql = eu[Bl]
      , ap = Ql.toLowerCase()
      , op = Ql[0].toUpperCase() + Ql.slice(1);
    Ie(ap, "on" + op)
}
Ie(Hs, "onAnimationEnd");
Ie(Js, "onAnimationIteration");
Ie(Ks, "onAnimationStart");
Ie("dblclick", "onDoubleClick");
Ie("focusin", "onFocus");
Ie("focusout", "onBlur");
Ie(Es, "onTransitionEnd");
Gt("onMouseEnter", ["mouseout", "mouseover"]);
Gt("onMouseLeave", ["mouseout", "mouseover"]);
Gt("onPointerEnter", ["pointerout", "pointerover"]);
Gt("onPointerLeave", ["pointerout", "pointerover"]);
Lt("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" "));
Lt("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));
Lt("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]);
Lt("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" "));
Lt("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" "));
Lt("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
var Sn = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" ")
  , up = new Set("cancel close invalid load scroll toggle".split(" ").concat(Sn));
function tu(A, e, t) {
    var n = A.type || "unknown-event";
    A.currentTarget = t,
    af(n, e, void 0, A),
    A.currentTarget = null
}
function Cs(A, e) {
    e = (e & 4) !== 0;
    for (var t = 0; t < A.length; t++) {
        var n = A[t]
          , r = n.event;
        n = n.listeners;
        A: {
            var l = void 0;
            if (e)
                for (var a = n.length - 1; 0 <= a; a--) {
                    var u = n[a]
                      , s = u.instance
                      , y = u.currentTarget;
                    if (u = u.listener,
                    s !== l && r.isPropagationStopped())
                        break A;
                    tu(r, u, y),
                    l = s
                }
            else
                for (a = 0; a < n.length; a++) {
                    if (u = n[a],
                    s = u.instance,
                    y = u.currentTarget,
                    u = u.listener,
                    s !== l && r.isPropagationStopped())
                        break A;
                    tu(r, u, y),
                    l = s
                }
        }
    }
    if (Jr)
        throw A = zi,
        Jr = !1,
        zi = null,
        A
}
function $(A, e) {
    var t = e[Wi];
    t === void 0 && (t = e[Wi] = new Set);
    var n = A + "__bubble";
    t.has(n) || (Gs(e, A, 2, !1),
    t.add(n))
}
function _l(A, e, t) {
    var n = 0;
    e && (n |= 4),
    Gs(t, A, n, e)
}
var mr = "_reactListening" + Math.random().toString(36).slice(2);
function Jn(A) {
    if (!A[mr]) {
        A[mr] = !0,
        As.forEach(function(t) {
            t !== "selectionchange" && (up.has(t) || _l(t, !1, A),
            _l(t, !0, A))
        });
        var e = A.nodeType === 9 ? A : A.ownerDocument;
        e === null || e[mr] || (e[mr] = !0,
        _l("selectionchange", !1, e))
    }
}
function Gs(A, e, t, n) {
    switch (Xs(e)) {
    case 1:
        var r = Tf;
        break;
    case 4:
        r = hf;
        break;
    default:
        r = xa
    }
    t = r.bind(null, e, t, A),
    r = void 0,
    !bi || e !== "touchstart" && e !== "touchmove" && e !== "wheel" || (r = !0),
    n ? r !== void 0 ? A.addEventListener(e, t, {
        capture: !0,
        passive: r
    }) : A.addEventListener(e, t, !0) : r !== void 0 ? A.addEventListener(e, t, {
        passive: r
    }) : A.addEventListener(e, t, !1)
}
function $l(A, e, t, n, r) {
    var l = n;
    if (!(e & 1) && !(e & 2) && n !== null)
        A: for (; ; ) {
            if (n === null)
                return;
            var a = n.tag;
            if (a === 3 || a === 4) {
                var u = n.stateNode.containerInfo;
                if (u === r || u.nodeType === 8 && u.parentNode === r)
                    break;
                if (a === 4)
                    for (a = n.return; a !== null; ) {
                        var s = a.tag;
                        if ((s === 3 || s === 4) && (s = a.stateNode.containerInfo,
                        s === r || s.nodeType === 8 && s.parentNode === r))
                            return;
                        a = a.return
                    }
                for (; u !== null; ) {
                    if (a = ot(u),
                    a === null)
                        return;
                    if (s = a.tag,
                    s === 5 || s === 6) {
                        n = l = a;
                        continue A
                    }
                    u = u.parentNode
                }
            }
            n = n.return
        }
    vs(function() {
        var y = l
          , N = ya(t)
          , L = [];
        A: {
            var m = Fs.get(A);
            if (m !== void 0) {
                var h = Na
                  , T = A;
                switch (A) {
                case "keypress":
                    if (qr(t) === 0)
                        break A;
                case "keydown":
                case "keyup":
                    h = Rf;
                    break;
                case "focusin":
                    T = "focus",
                    h = Cl;
                    break;
                case "focusout":
                    T = "blur",
                    h = Cl;
                    break;
                case "beforeblur":
                case "afterblur":
                    h = Cl;
                    break;
                case "click":
                    if (t.button === 2)
                        break A;
                case "auxclick":
                case "dblclick":
                case "mousedown":
                case "mousemove":
                case "mouseup":
                case "mouseout":
                case "mouseover":
                case "contextmenu":
                    h = Eo;
                    break;
                case "drag":
                case "dragend":
                case "dragenter":
                case "dragexit":
                case "dragleave":
                case "dragover":
                case "dragstart":
                case "drop":
                    h = zf;
                    break;
                case "touchcancel":
                case "touchend":
                case "touchmove":
                case "touchstart":
                    h = Jf;
                    break;
                case Hs:
                case Js:
                case Ks:
                    h = Xf;
                    break;
                case Es:
                    h = Ef;
                    break;
                case "scroll":
                    h = Mf;
                    break;
                case "wheel":
                    h = Cf;
                    break;
                case "copy":
                case "cut":
                case "paste":
                    h = Of;
                    break;
                case "gotpointercapture":
                case "lostpointercapture":
                case "pointercancel":
                case "pointerdown":
                case "pointermove":
                case "pointerout":
                case "pointerover":
                case "pointerup":
                    h = Co
                }
                var M = (e & 4) !== 0
                  , J = !M && A === "scroll"
                  , f = M ? m !== null ? m + "Capture" : null : m;
                M = [];
                for (var p = y, v; p !== null; ) {
                    v = p;
                    var x = v.stateNode;
                    if (v.tag === 5 && x !== null && (v = x,
                    f !== null && (x = Un(p, f),
                    x != null && M.push(Kn(p, x, v)))),
                    J)
                        break;
                    p = p.return
                }
                0 < M.length && (m = new h(m,T,null,t,N),
                L.push({
                    event: m,
                    listeners: M
                }))
            }
        }
        if (!(e & 7)) {
            A: {
                if (m = A === "mouseover" || A === "pointerover",
                h = A === "mouseout" || A === "pointerout",
                m && t !== hi && (T = t.relatedTarget || t.fromElement) && (ot(T) || T[Me]))
                    break A;
                if ((h || m) && (m = N.window === N ? N : (m = N.ownerDocument) ? m.defaultView || m.parentWindow : window,
                h ? (T = t.relatedTarget || t.toElement,
                h = y,
                T = T ? ot(T) : null,
                T !== null && (J = xt(T),
                T !== J || T.tag !== 5 && T.tag !== 6) && (T = null)) : (h = null,
                T = y),
                h !== T)) {
                    if (M = Eo,
                    x = "onMouseLeave",
                    f = "onMouseEnter",
                    p = "mouse",
                    (A === "pointerout" || A === "pointerover") && (M = Co,
                    x = "onPointerLeave",
                    f = "onPointerEnter",
                    p = "pointer"),
                    J = h == null ? m : Pt(h),
                    v = T == null ? m : Pt(T),
                    m = new M(x,p + "leave",h,t,N),
                    m.target = J,
                    m.relatedTarget = v,
                    x = null,
                    ot(N) === y && (M = new M(f,p + "enter",T,t,N),
                    M.target = v,
                    M.relatedTarget = J,
                    x = M),
                    J = x,
                    h && T)
                        e: {
                            for (M = h,
                            f = T,
                            p = 0,
                            v = M; v; v = zt(v))
                                p++;
                            for (v = 0,
                            x = f; x; x = zt(x))
                                v++;
                            for (; 0 < p - v; )
                                M = zt(M),
                                p--;
                            for (; 0 < v - p; )
                                f = zt(f),
                                v--;
                            for (; p--; ) {
                                if (M === f || f !== null && M === f.alternate)
                                    break e;
                                M = zt(M),
                                f = zt(f)
                            }
                            M = null
                        }
                    else
                        M = null;
                    h !== null && nu(L, m, h, M, !1),
                    T !== null && J !== null && nu(L, J, T, M, !0)
                }
            }
            A: {
                if (m = y ? Pt(y) : window,
                h = m.nodeName && m.nodeName.toLowerCase(),
                h === "select" || h === "input" && m.type === "file")
                    var b = $f;
                else if (Yo(m))
                    if (Us)
                        b = np;
                    else {
                        b = ep;
                        var O = Ap
                    }
                else
                    (h = m.nodeName) && h.toLowerCase() === "input" && (m.type === "checkbox" || m.type === "radio") && (b = tp);
                if (b && (b = b(A, y))) {
                    ws(L, b, t, N);
                    break A
                }
                O && O(A, m, y),
                A === "focusout" && (O = m._wrapperState) && O.controlled && m.type === "number" && xi(m, "number", m.value)
            }
            switch (O = y ? Pt(y) : window,
            A) {
            case "focusin":
                (Yo(O) || O.contentEditable === "true") && (Ot = O,
                qi = y,
                Vn = null);
                break;
            case "focusout":
                Vn = qi = Ot = null;
                break;
            case "mousedown":
                Oi = !0;
                break;
            case "contextmenu":
            case "mouseup":
            case "dragend":
                Oi = !1,
                Au(L, t, N);
                break;
            case "selectionchange":
                if (ip)
                    break;
            case "keydown":
            case "keyup":
                Au(L, t, N)
            }
            var k;
            if (Ta)
                A: {
                    switch (A) {
                    case "compositionstart":
                        var w = "onCompositionStart";
                        break A;
                    case "compositionend":
                        w = "onCompositionEnd";
                        break A;
                    case "compositionupdate":
                        w = "onCompositionUpdate";
                        break A
                    }
                    w = void 0
                }
            else
                qt ? ks(A, t) && (w = "onCompositionEnd") : A === "keydown" && t.keyCode === 229 && (w = "onCompositionStart");
            w && (Os && t.locale !== "ko" && (qt || w !== "onCompositionStart" ? w === "onCompositionEnd" && qt && (k = qs()) : (Ue = N,
            ja = "value"in Ue ? Ue.value : Ue.textContent,
            qt = !0)),
            O = Gr(y, w),
            0 < O.length && (w = new Fo(w,A,null,t,N),
            L.push({
                event: w,
                listeners: O
            }),
            k ? w.data = k : (k = Ps(t),
            k !== null && (w.data = k)))),
            (k = If ? Yf(A, t) : Bf(A, t)) && (y = Gr(y, "onBeforeInput"),
            0 < y.length && (N = new Fo("onBeforeInput","beforeinput",null,t,N),
            L.push({
                event: N,
                listeners: y
            }),
            N.data = k))
        }
        Cs(L, e)
    })
}
function Kn(A, e, t) {
    return {
        instance: A,
        listener: e,
        currentTarget: t
    }
}
function Gr(A, e) {
    for (var t = e + "Capture", n = []; A !== null; ) {
        var r = A
          , l = r.stateNode;
        r.tag === 5 && l !== null && (r = l,
        l = Un(A, t),
        l != null && n.unshift(Kn(A, l, r)),
        l = Un(A, e),
        l != null && n.push(Kn(A, l, r))),
        A = A.return
    }
    return n
}
function zt(A) {
    if (A === null)
        return null;
    do
        A = A.return;
    while (A && A.tag !== 5);
    return A || null
}
function nu(A, e, t, n, r) {
    for (var l = e._reactName, a = []; t !== null && t !== n; ) {
        var u = t
          , s = u.alternate
          , y = u.stateNode;
        if (s !== null && s === n)
            break;
        u.tag === 5 && y !== null && (u = y,
        r ? (s = Un(t, l),
        s != null && a.unshift(Kn(t, s, u))) : r || (s = Un(t, l),
        s != null && a.push(Kn(t, s, u)))),
        t = t.return
    }
    a.length !== 0 && A.push({
        event: e,
        listeners: a
    })
}
var sp = /\r\n?/g
  , dp = /\u0000|\uFFFD/g;
function ru(A) {
    return (typeof A == "string" ? A : "" + A).replace(sp, `
`).replace(dp, "")
}
function Lr(A, e, t) {
    if (e = ru(e),
    ru(A) !== e && t)
        throw Error(S(425))
}
function Ir() {}
var ki = null
  , Pi = null;
function wi(A, e) {
    return A === "textarea" || A === "noscript" || typeof e.children == "string" || typeof e.children == "number" || typeof e.dangerouslySetInnerHTML == "object" && e.dangerouslySetInnerHTML !== null && e.dangerouslySetInnerHTML.__html != null
}
var Ui = typeof setTimeout == "function" ? setTimeout : void 0
  , cp = typeof clearTimeout == "function" ? clearTimeout : void 0
  , lu = typeof Promise == "function" ? Promise : void 0
  , fp = typeof queueMicrotask == "function" ? queueMicrotask : typeof lu < "u" ? function(A) {
    return lu.resolve(null).then(A).catch(pp)
}
: Ui;
function pp(A) {
    setTimeout(function() {
        throw A
    })
}
function Ai(A, e) {
    var t = e
      , n = 0;
    do {
        var r = t.nextSibling;
        if (A.removeChild(t),
        r && r.nodeType === 8)
            if (t = r.data,
            t === "/$") {
                if (n === 0) {
                    A.removeChild(r),
                    Rn(e);
                    return
                }
                n--
            } else
                t !== "$" && t !== "$?" && t !== "$!" || n++;
        t = r
    } while (t);
    Rn(e)
}
function He(A) {
    for (; A != null; A = A.nextSibling) {
        var e = A.nodeType;
        if (e === 1 || e === 3)
            break;
        if (e === 8) {
            if (e = A.data,
            e === "$" || e === "$!" || e === "$?")
                break;
            if (e === "/$")
                return null
        }
    }
    return A
}
function iu(A) {
    A = A.previousSibling;
    for (var e = 0; A; ) {
        if (A.nodeType === 8) {
            var t = A.data;
            if (t === "$" || t === "$!" || t === "$?") {
                if (e === 0)
                    return A;
                e--
            } else
                t === "/$" && e++
        }
        A = A.previousSibling
    }
    return null
}
var tn = Math.random().toString(36).slice(2)
  , pe = "__reactFiber$" + tn
  , En = "__reactProps$" + tn
  , Me = "__reactContainer$" + tn
  , Wi = "__reactEvents$" + tn
  , yp = "__reactListeners$" + tn
  , vp = "__reactHandles$" + tn;
function ot(A) {
    var e = A[pe];
    if (e)
        return e;
    for (var t = A.parentNode; t; ) {
        if (e = t[Me] || t[pe]) {
            if (t = e.alternate,
            e.child !== null || t !== null && t.child !== null)
                for (A = iu(A); A !== null; ) {
                    if (t = A[pe])
                        return t;
                    A = iu(A)
                }
            return e
        }
        A = t,
        t = A.parentNode
    }
    return null
}
function er(A) {
    return A = A[pe] || A[Me],
    !A || A.tag !== 5 && A.tag !== 6 && A.tag !== 13 && A.tag !== 3 ? null : A
}
function Pt(A) {
    if (A.tag === 5 || A.tag === 6)
        return A.stateNode;
    throw Error(S(33))
}
function xl(A) {
    return A[En] || null
}
var Zi = []
  , wt = -1;
function Ye(A) {
    return {
        current: A
    }
}
function AA(A) {
    0 > wt || (A.current = Zi[wt],
    Zi[wt] = null,
    wt--)
}
function Q(A, e) {
    wt++,
    Zi[wt] = A.current,
    A.current = e
}
var Ge = {}
  , VA = Ye(Ge)
  , WA = Ye(!1)
  , ft = Ge;
function It(A, e) {
    var t = A.type.contextTypes;
    if (!t)
        return Ge;
    var n = A.stateNode;
    if (n && n.__reactInternalMemoizedUnmaskedChildContext === e)
        return n.__reactInternalMemoizedMaskedChildContext;
    var r = {}, l;
    for (l in t)
        r[l] = e[l];
    return n && (A = A.stateNode,
    A.__reactInternalMemoizedUnmaskedChildContext = e,
    A.__reactInternalMemoizedMaskedChildContext = r),
    r
}
function ZA(A) {
    return A = A.childContextTypes,
    A != null
}
function Yr() {
    AA(WA),
    AA(VA)
}
function au(A, e, t) {
    if (VA.current !== Ge)
        throw Error(S(168));
    Q(VA, e),
    Q(WA, t)
}
function Is(A, e, t) {
    var n = A.stateNode;
    if (e = e.childContextTypes,
    typeof n.getChildContext != "function")
        return t;
    n = n.getChildContext();
    for (var r in n)
        if (!(r in e))
            throw Error(S(108, $c(A) || "Unknown", r));
    return aA({}, t, n)
}
function Br(A) {
    return A = (A = A.stateNode) && A.__reactInternalMemoizedMergedChildContext || Ge,
    ft = VA.current,
    Q(VA, A),
    Q(WA, WA.current),
    !0
}
function ou(A, e, t) {
    var n = A.stateNode;
    if (!n)
        throw Error(S(169));
    t ? (A = Is(A, e, ft),
    n.__reactInternalMemoizedMergedChildContext = A,
    AA(WA),
    AA(VA),
    Q(VA, A)) : AA(WA),
    Q(WA, t)
}
var je = null
  , jl = !1
  , ei = !1;
function Ys(A) {
    je === null ? je = [A] : je.push(A)
}
function mp(A) {
    jl = !0,
    Ys(A)
}
function Be() {
    if (!ei && je !== null) {
        ei = !0;
        var A = 0
          , e = I;
        try {
            var t = je;
            for (I = 1; A < t.length; A++) {
                var n = t[A];
                do
                    n = n(!0);
                while (n !== null)
            }
            je = null,
            jl = !1
        } catch (r) {
            throw je !== null && (je = je.slice(A + 1)),
            js(va, Be),
            r
        } finally {
            I = e,
            ei = !1
        }
    }
    return null
}
var Ut = []
  , Wt = 0
  , Qr = null
  , _r = 0
  , _A = []
  , $A = 0
  , pt = null
  , Ne = 1
  , Se = "";
function it(A, e) {
    Ut[Wt++] = _r,
    Ut[Wt++] = Qr,
    Qr = A,
    _r = e
}
function Bs(A, e, t) {
    _A[$A++] = Ne,
    _A[$A++] = Se,
    _A[$A++] = pt,
    pt = A;
    var n = Ne;
    A = Se;
    var r = 32 - oe(n) - 1;
    n &= ~(1 << r),
    t += 1;
    var l = 32 - oe(e) + r;
    if (30 < l) {
        var a = r - r % 5;
        l = (n & (1 << a) - 1).toString(32),
        n >>= a,
        r -= a,
        Ne = 1 << 32 - oe(e) + r | t << r | n,
        Se = l + A
    } else
        Ne = 1 << l | t << r | n,
        Se = A
}
function Ma(A) {
    A.return !== null && (it(A, 1),
    Bs(A, 1, 0))
}
function ba(A) {
    for (; A === Qr; )
        Qr = Ut[--Wt],
        Ut[Wt] = null,
        _r = Ut[--Wt],
        Ut[Wt] = null;
    for (; A === pt; )
        pt = _A[--$A],
        _A[$A] = null,
        Se = _A[--$A],
        _A[$A] = null,
        Ne = _A[--$A],
        _A[$A] = null
}
var FA = null
  , EA = null
  , eA = !1
  , ae = null;
function Qs(A, e) {
    var t = Ae(5, null, null, 0);
    t.elementType = "DELETED",
    t.stateNode = e,
    t.return = A,
    e = A.deletions,
    e === null ? (A.deletions = [t],
    A.flags |= 16) : e.push(t)
}
function uu(A, e) {
    switch (A.tag) {
    case 5:
        var t = A.type;
        return e = e.nodeType !== 1 || t.toLowerCase() !== e.nodeName.toLowerCase() ? null : e,
        e !== null ? (A.stateNode = e,
        FA = A,
        EA = He(e.firstChild),
        !0) : !1;
    case 6:
        return e = A.pendingProps === "" || e.nodeType !== 3 ? null : e,
        e !== null ? (A.stateNode = e,
        FA = A,
        EA = null,
        !0) : !1;
    case 13:
        return e = e.nodeType !== 8 ? null : e,
        e !== null ? (t = pt !== null ? {
            id: Ne,
            overflow: Se
        } : null,
        A.memoizedState = {
            dehydrated: e,
            treeContext: t,
            retryLane: 1073741824
        },
        t = Ae(18, null, null, 0),
        t.stateNode = e,
        t.return = A,
        A.child = t,
        FA = A,
        EA = null,
        !0) : !1;
    default:
        return !1
    }
}
function Ri(A) {
    return (A.mode & 1) !== 0 && (A.flags & 128) === 0
}
function Di(A) {
    if (eA) {
        var e = EA;
        if (e) {
            var t = e;
            if (!uu(A, e)) {
                if (Ri(A))
                    throw Error(S(418));
                e = He(t.nextSibling);
                var n = FA;
                e && uu(A, e) ? Qs(n, t) : (A.flags = A.flags & -4097 | 2,
                eA = !1,
                FA = A)
            }
        } else {
            if (Ri(A))
                throw Error(S(418));
            A.flags = A.flags & -4097 | 2,
            eA = !1,
            FA = A
        }
    }
}
function su(A) {
    for (A = A.return; A !== null && A.tag !== 5 && A.tag !== 3 && A.tag !== 13; )
        A = A.return;
    FA = A
}
function xr(A) {
    if (A !== FA)
        return !1;
    if (!eA)
        return su(A),
        eA = !0,
        !1;
    var e;
    if ((e = A.tag !== 3) && !(e = A.tag !== 5) && (e = A.type,
    e = e !== "head" && e !== "body" && !wi(A.type, A.memoizedProps)),
    e && (e = EA)) {
        if (Ri(A))
            throw _s(),
            Error(S(418));
        for (; e; )
            Qs(A, e),
            e = He(e.nextSibling)
    }
    if (su(A),
    A.tag === 13) {
        if (A = A.memoizedState,
        A = A !== null ? A.dehydrated : null,
        !A)
            throw Error(S(317));
        A: {
            for (A = A.nextSibling,
            e = 0; A; ) {
                if (A.nodeType === 8) {
                    var t = A.data;
                    if (t === "/$") {
                        if (e === 0) {
                            EA = He(A.nextSibling);
                            break A
                        }
                        e--
                    } else
                        t !== "$" && t !== "$!" && t !== "$?" || e++
                }
                A = A.nextSibling
            }
            EA = null
        }
    } else
        EA = FA ? He(A.stateNode.nextSibling) : null;
    return !0
}
function _s() {
    for (var A = EA; A; )
        A = He(A.nextSibling)
}
function Yt() {
    EA = FA = null,
    eA = !1
}
function za(A) {
    ae === null ? ae = [A] : ae.push(A)
}
var Lp = ge.ReactCurrentBatchConfig;
function yn(A, e, t) {
    if (A = t.ref,
    A !== null && typeof A != "function" && typeof A != "object") {
        if (t._owner) {
            if (t = t._owner,
            t) {
                if (t.tag !== 1)
                    throw Error(S(309));
                var n = t.stateNode
            }
            if (!n)
                throw Error(S(147, A));
            var r = n
              , l = "" + A;
            return e !== null && e.ref !== null && typeof e.ref == "function" && e.ref._stringRef === l ? e.ref : (e = function(a) {
                var u = r.refs;
                a === null ? delete u[l] : u[l] = a
            }
            ,
            e._stringRef = l,
            e)
        }
        if (typeof A != "string")
            throw Error(S(284));
        if (!t._owner)
            throw Error(S(290, A))
    }
    return A
}
function jr(A, e) {
    throw A = Object.prototype.toString.call(e),
    Error(S(31, A === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : A))
}
function du(A) {
    var e = A._init;
    return e(A._payload)
}
function $s(A) {
    function e(f, p) {
        if (A) {
            var v = f.deletions;
            v === null ? (f.deletions = [p],
            f.flags |= 16) : v.push(p)
        }
    }
    function t(f, p) {
        if (!A)
            return null;
        for (; p !== null; )
            e(f, p),
            p = p.sibling;
        return null
    }
    function n(f, p) {
        for (f = new Map; p !== null; )
            p.key !== null ? f.set(p.key, p) : f.set(p.index, p),
            p = p.sibling;
        return f
    }
    function r(f, p) {
        return f = Fe(f, p),
        f.index = 0,
        f.sibling = null,
        f
    }
    function l(f, p, v) {
        return f.index = v,
        A ? (v = f.alternate,
        v !== null ? (v = v.index,
        v < p ? (f.flags |= 2,
        p) : v) : (f.flags |= 2,
        p)) : (f.flags |= 1048576,
        p)
    }
    function a(f) {
        return A && f.alternate === null && (f.flags |= 2),
        f
    }
    function u(f, p, v, x) {
        return p === null || p.tag !== 6 ? (p = oi(v, f.mode, x),
        p.return = f,
        p) : (p = r(p, v),
        p.return = f,
        p)
    }
    function s(f, p, v, x) {
        var b = v.type;
        return b === Xt ? N(f, p, v.props.children, x, v.key) : p !== null && (p.elementType === b || typeof b == "object" && b !== null && b.$$typeof === Oe && du(b) === p.type) ? (x = r(p, v.props),
        x.ref = yn(f, p, v),
        x.return = f,
        x) : (x = Zr(v.type, v.key, v.props, null, f.mode, x),
        x.ref = yn(f, p, v),
        x.return = f,
        x)
    }
    function y(f, p, v, x) {
        return p === null || p.tag !== 4 || p.stateNode.containerInfo !== v.containerInfo || p.stateNode.implementation !== v.implementation ? (p = ui(v, f.mode, x),
        p.return = f,
        p) : (p = r(p, v.children || []),
        p.return = f,
        p)
    }
    function N(f, p, v, x, b) {
        return p === null || p.tag !== 7 ? (p = ct(v, f.mode, x, b),
        p.return = f,
        p) : (p = r(p, v),
        p.return = f,
        p)
    }
    function L(f, p, v) {
        if (typeof p == "string" && p !== "" || typeof p == "number")
            return p = oi("" + p, f.mode, v),
            p.return = f,
            p;
        if (typeof p == "object" && p !== null) {
            switch (p.$$typeof) {
            case ur:
                return v = Zr(p.type, p.key, p.props, null, f.mode, v),
                v.ref = yn(f, null, p),
                v.return = f,
                v;
            case Vt:
                return p = ui(p, f.mode, v),
                p.return = f,
                p;
            case Oe:
                var x = p._init;
                return L(f, x(p._payload), v)
            }
            if (jn(p) || sn(p))
                return p = ct(p, f.mode, v, null),
                p.return = f,
                p;
            jr(f, p)
        }
        return null
    }
    function m(f, p, v, x) {
        var b = p !== null ? p.key : null;
        if (typeof v == "string" && v !== "" || typeof v == "number")
            return b !== null ? null : u(f, p, "" + v, x);
        if (typeof v == "object" && v !== null) {
            switch (v.$$typeof) {
            case ur:
                return v.key === b ? s(f, p, v, x) : null;
            case Vt:
                return v.key === b ? y(f, p, v, x) : null;
            case Oe:
                return b = v._init,
                m(f, p, b(v._payload), x)
            }
            if (jn(v) || sn(v))
                return b !== null ? null : N(f, p, v, x, null);
            jr(f, v)
        }
        return null
    }
    function h(f, p, v, x, b) {
        if (typeof x == "string" && x !== "" || typeof x == "number")
            return f = f.get(v) || null,
            u(p, f, "" + x, b);
        if (typeof x == "object" && x !== null) {
            switch (x.$$typeof) {
            case ur:
                return f = f.get(x.key === null ? v : x.key) || null,
                s(p, f, x, b);
            case Vt:
                return f = f.get(x.key === null ? v : x.key) || null,
                y(p, f, x, b);
            case Oe:
                var O = x._init;
                return h(f, p, v, O(x._payload), b)
            }
            if (jn(x) || sn(x))
                return f = f.get(v) || null,
                N(p, f, x, b, null);
            jr(p, x)
        }
        return null
    }
    function T(f, p, v, x) {
        for (var b = null, O = null, k = p, w = p = 0, Y = null; k !== null && w < v.length; w++) {
            k.index > w ? (Y = k,
            k = null) : Y = k.sibling;
            var U = m(f, k, v[w], x);
            if (U === null) {
                k === null && (k = Y);
                break
            }
            A && k && U.alternate === null && e(f, k),
            p = l(U, p, w),
            O === null ? b = U : O.sibling = U,
            O = U,
            k = Y
        }
        if (w === v.length)
            return t(f, k),
            eA && it(f, w),
            b;
        if (k === null) {
            for (; w < v.length; w++)
                k = L(f, v[w], x),
                k !== null && (p = l(k, p, w),
                O === null ? b = k : O.sibling = k,
                O = k);
            return eA && it(f, w),
            b
        }
        for (k = n(f, k); w < v.length; w++)
            Y = h(k, f, w, v[w], x),
            Y !== null && (A && Y.alternate !== null && k.delete(Y.key === null ? w : Y.key),
            p = l(Y, p, w),
            O === null ? b = Y : O.sibling = Y,
            O = Y);
        return A && k.forEach(function(xA) {
            return e(f, xA)
        }),
        eA && it(f, w),
        b
    }
    function M(f, p, v, x) {
        var b = sn(v);
        if (typeof b != "function")
            throw Error(S(150));
        if (v = b.call(v),
        v == null)
            throw Error(S(151));
        for (var O = b = null, k = p, w = p = 0, Y = null, U = v.next(); k !== null && !U.done; w++,
        U = v.next()) {
            k.index > w ? (Y = k,
            k = null) : Y = k.sibling;
            var xA = m(f, k, U.value, x);
            if (xA === null) {
                k === null && (k = Y);
                break
            }
            A && k && xA.alternate === null && e(f, k),
            p = l(xA, p, w),
            O === null ? b = xA : O.sibling = xA,
            O = xA,
            k = Y
        }
        if (U.done)
            return t(f, k),
            eA && it(f, w),
            b;
        if (k === null) {
            for (; !U.done; w++,
            U = v.next())
                U = L(f, U.value, x),
                U !== null && (p = l(U, p, w),
                O === null ? b = U : O.sibling = U,
                O = U);
            return eA && it(f, w),
            b
        }
        for (k = n(f, k); !U.done; w++,
        U = v.next())
            U = h(k, f, w, U.value, x),
            U !== null && (A && U.alternate !== null && k.delete(U.key === null ? w : U.key),
            p = l(U, p, w),
            O === null ? b = U : O.sibling = U,
            O = U);
        return A && k.forEach(function(YA) {
            return e(f, YA)
        }),
        eA && it(f, w),
        b
    }
    function J(f, p, v, x) {
        if (typeof v == "object" && v !== null && v.type === Xt && v.key === null && (v = v.props.children),
        typeof v == "object" && v !== null) {
            switch (v.$$typeof) {
            case ur:
                A: {
                    for (var b = v.key, O = p; O !== null; ) {
                        if (O.key === b) {
                            if (b = v.type,
                            b === Xt) {
                                if (O.tag === 7) {
                                    t(f, O.sibling),
                                    p = r(O, v.props.children),
                                    p.return = f,
                                    f = p;
                                    break A
                                }
                            } else if (O.elementType === b || typeof b == "object" && b !== null && b.$$typeof === Oe && du(b) === O.type) {
                                t(f, O.sibling),
                                p = r(O, v.props),
                                p.ref = yn(f, O, v),
                                p.return = f,
                                f = p;
                                break A
                            }
                            t(f, O);
                            break
                        } else
                            e(f, O);
                        O = O.sibling
                    }
                    v.type === Xt ? (p = ct(v.props.children, f.mode, x, v.key),
                    p.return = f,
                    f = p) : (x = Zr(v.type, v.key, v.props, null, f.mode, x),
                    x.ref = yn(f, p, v),
                    x.return = f,
                    f = x)
                }
                return a(f);
            case Vt:
                A: {
                    for (O = v.key; p !== null; ) {
                        if (p.key === O)
                            if (p.tag === 4 && p.stateNode.containerInfo === v.containerInfo && p.stateNode.implementation === v.implementation) {
                                t(f, p.sibling),
                                p = r(p, v.children || []),
                                p.return = f,
                                f = p;
                                break A
                            } else {
                                t(f, p);
                                break
                            }
                        else
                            e(f, p);
                        p = p.sibling
                    }
                    p = ui(v, f.mode, x),
                    p.return = f,
                    f = p
                }
                return a(f);
            case Oe:
                return O = v._init,
                J(f, p, O(v._payload), x)
            }
            if (jn(v))
                return T(f, p, v, x);
            if (sn(v))
                return M(f, p, v, x);
            jr(f, v)
        }
        return typeof v == "string" && v !== "" || typeof v == "number" ? (v = "" + v,
        p !== null && p.tag === 6 ? (t(f, p.sibling),
        p = r(p, v),
        p.return = f,
        f = p) : (t(f, p),
        p = oi(v, f.mode, x),
        p.return = f,
        f = p),
        a(f)) : t(f, p)
    }
    return J
}
var Bt = $s(!0)
  , Ad = $s(!1)
  , $r = Ye(null)
  , Al = null
  , Zt = null
  , ga = null;
function Va() {
    ga = Zt = Al = null
}
function Xa(A) {
    var e = $r.current;
    AA($r),
    A._currentValue = e
}
function Hi(A, e, t) {
    for (; A !== null; ) {
        var n = A.alternate;
        if ((A.childLanes & e) !== e ? (A.childLanes |= e,
        n !== null && (n.childLanes |= e)) : n !== null && (n.childLanes & e) !== e && (n.childLanes |= e),
        A === t)
            break;
        A = A.return
    }
}
function Ft(A, e) {
    Al = A,
    ga = Zt = null,
    A = A.dependencies,
    A !== null && A.firstContext !== null && (A.lanes & e && (UA = !0),
    A.firstContext = null)
}
function te(A) {
    var e = A._currentValue;
    if (ga !== A)
        if (A = {
            context: A,
            memoizedValue: e,
            next: null
        },
        Zt === null) {
            if (Al === null)
                throw Error(S(308));
            Zt = A,
            Al.dependencies = {
                lanes: 0,
                firstContext: A
            }
        } else
            Zt = Zt.next = A;
    return e
}
var ut = null;
function qa(A) {
    ut === null ? ut = [A] : ut.push(A)
}
function ed(A, e, t, n) {
    var r = e.interleaved;
    return r === null ? (t.next = t,
    qa(e)) : (t.next = r.next,
    r.next = t),
    e.interleaved = t,
    be(A, n)
}
function be(A, e) {
    A.lanes |= e;
    var t = A.alternate;
    for (t !== null && (t.lanes |= e),
    t = A,
    A = A.return; A !== null; )
        A.childLanes |= e,
        t = A.alternate,
        t !== null && (t.childLanes |= e),
        t = A,
        A = A.return;
    return t.tag === 3 ? t.stateNode : null
}
var ke = !1;
function Oa(A) {
    A.updateQueue = {
        baseState: A.memoizedState,
        firstBaseUpdate: null,
        lastBaseUpdate: null,
        shared: {
            pending: null,
            interleaved: null,
            lanes: 0
        },
        effects: null
    }
}
function td(A, e) {
    A = A.updateQueue,
    e.updateQueue === A && (e.updateQueue = {
        baseState: A.baseState,
        firstBaseUpdate: A.firstBaseUpdate,
        lastBaseUpdate: A.lastBaseUpdate,
        shared: A.shared,
        effects: A.effects
    })
}
function Te(A, e) {
    return {
        eventTime: A,
        lane: e,
        tag: 0,
        payload: null,
        callback: null,
        next: null
    }
}
function Je(A, e, t) {
    var n = A.updateQueue;
    if (n === null)
        return null;
    if (n = n.shared,
    C & 2) {
        var r = n.pending;
        return r === null ? e.next = e : (e.next = r.next,
        r.next = e),
        n.pending = e,
        be(A, t)
    }
    return r = n.interleaved,
    r === null ? (e.next = e,
    qa(n)) : (e.next = r.next,
    r.next = e),
    n.interleaved = e,
    be(A, t)
}
function Or(A, e, t) {
    if (e = e.updateQueue,
    e !== null && (e = e.shared,
    (t & 4194240) !== 0)) {
        var n = e.lanes;
        n &= A.pendingLanes,
        t |= n,
        e.lanes = t,
        ma(A, t)
    }
}
function cu(A, e) {
    var t = A.updateQueue
      , n = A.alternate;
    if (n !== null && (n = n.updateQueue,
    t === n)) {
        var r = null
          , l = null;
        if (t = t.firstBaseUpdate,
        t !== null) {
            do {
                var a = {
                    eventTime: t.eventTime,
                    lane: t.lane,
                    tag: t.tag,
                    payload: t.payload,
                    callback: t.callback,
                    next: null
                };
                l === null ? r = l = a : l = l.next = a,
                t = t.next
            } while (t !== null);
            l === null ? r = l = e : l = l.next = e
        } else
            r = l = e;
        t = {
            baseState: n.baseState,
            firstBaseUpdate: r,
            lastBaseUpdate: l,
            shared: n.shared,
            effects: n.effects
        },
        A.updateQueue = t;
        return
    }
    A = t.lastBaseUpdate,
    A === null ? t.firstBaseUpdate = e : A.next = e,
    t.lastBaseUpdate = e
}
function el(A, e, t, n) {
    var r = A.updateQueue;
    ke = !1;
    var l = r.firstBaseUpdate
      , a = r.lastBaseUpdate
      , u = r.shared.pending;
    if (u !== null) {
        r.shared.pending = null;
        var s = u
          , y = s.next;
        s.next = null,
        a === null ? l = y : a.next = y,
        a = s;
        var N = A.alternate;
        N !== null && (N = N.updateQueue,
        u = N.lastBaseUpdate,
        u !== a && (u === null ? N.firstBaseUpdate = y : u.next = y,
        N.lastBaseUpdate = s))
    }
    if (l !== null) {
        var L = r.baseState;
        a = 0,
        N = y = s = null,
        u = l;
        do {
            var m = u.lane
              , h = u.eventTime;
            if ((n & m) === m) {
                N !== null && (N = N.next = {
                    eventTime: h,
                    lane: 0,
                    tag: u.tag,
                    payload: u.payload,
                    callback: u.callback,
                    next: null
                });
                A: {
                    var T = A
                      , M = u;
                    switch (m = e,
                    h = t,
                    M.tag) {
                    case 1:
                        if (T = M.payload,
                        typeof T == "function") {
                            L = T.call(h, L, m);
                            break A
                        }
                        L = T;
                        break A;
                    case 3:
                        T.flags = T.flags & -65537 | 128;
                    case 0:
                        if (T = M.payload,
                        m = typeof T == "function" ? T.call(h, L, m) : T,
                        m == null)
                            break A;
                        L = aA({}, L, m);
                        break A;
                    case 2:
                        ke = !0
                    }
                }
                u.callback !== null && u.lane !== 0 && (A.flags |= 64,
                m = r.effects,
                m === null ? r.effects = [u] : m.push(u))
            } else
                h = {
                    eventTime: h,
                    lane: m,
                    tag: u.tag,
                    payload: u.payload,
                    callback: u.callback,
                    next: null
                },
                N === null ? (y = N = h,
                s = L) : N = N.next = h,
                a |= m;
            if (u = u.next,
            u === null) {
                if (u = r.shared.pending,
                u === null)
                    break;
                m = u,
                u = m.next,
                m.next = null,
                r.lastBaseUpdate = m,
                r.shared.pending = null
            }
        } while (!0);
        if (N === null && (s = L),
        r.baseState = s,
        r.firstBaseUpdate = y,
        r.lastBaseUpdate = N,
        e = r.shared.interleaved,
        e !== null) {
            r = e;
            do
                a |= r.lane,
                r = r.next;
            while (r !== e)
        } else
            l === null && (r.shared.lanes = 0);
        vt |= a,
        A.lanes = a,
        A.memoizedState = L
    }
}
function fu(A, e, t) {
    if (A = e.effects,
    e.effects = null,
    A !== null)
        for (e = 0; e < A.length; e++) {
            var n = A[e]
              , r = n.callback;
            if (r !== null) {
                if (n.callback = null,
                n = t,
                typeof r != "function")
                    throw Error(S(191, r));
                r.call(n)
            }
        }
}
var tr = {}
  , ve = Ye(tr)
  , Fn = Ye(tr)
  , Cn = Ye(tr);
function st(A) {
    if (A === tr)
        throw Error(S(174));
    return A
}
function ka(A, e) {
    switch (Q(Cn, e),
    Q(Fn, A),
    Q(ve, tr),
    A = e.nodeType,
    A) {
    case 9:
    case 11:
        e = (e = e.documentElement) ? e.namespaceURI : Ni(null, "");
        break;
    default:
        A = A === 8 ? e.parentNode : e,
        e = A.namespaceURI || null,
        A = A.tagName,
        e = Ni(e, A)
    }
    AA(ve),
    Q(ve, e)
}
function Qt() {
    AA(ve),
    AA(Fn),
    AA(Cn)
}
function nd(A) {
    st(Cn.current);
    var e = st(ve.current)
      , t = Ni(e, A.type);
    e !== t && (Q(Fn, A),
    Q(ve, t))
}
function Pa(A) {
    Fn.current === A && (AA(ve),
    AA(Fn))
}
var lA = Ye(0);
function tl(A) {
    for (var e = A; e !== null; ) {
        if (e.tag === 13) {
            var t = e.memoizedState;
            if (t !== null && (t = t.dehydrated,
            t === null || t.data === "$?" || t.data === "$!"))
                return e
        } else if (e.tag === 19 && e.memoizedProps.revealOrder !== void 0) {
            if (e.flags & 128)
                return e
        } else if (e.child !== null) {
            e.child.return = e,
            e = e.child;
            continue
        }
        if (e === A)
            break;
        for (; e.sibling === null; ) {
            if (e.return === null || e.return === A)
                return null;
            e = e.return
        }
        e.sibling.return = e.return,
        e = e.sibling
    }
    return null
}
var ti = [];
function wa() {
    for (var A = 0; A < ti.length; A++)
        ti[A]._workInProgressVersionPrimary = null;
    ti.length = 0
}
var kr = ge.ReactCurrentDispatcher
  , ni = ge.ReactCurrentBatchConfig
  , yt = 0
  , iA = null
  , pA = null
  , mA = null
  , nl = !1
  , Xn = !1
  , Gn = 0
  , xp = 0;
function bA() {
    throw Error(S(321))
}
function Ua(A, e) {
    if (e === null)
        return !1;
    for (var t = 0; t < e.length && t < A.length; t++)
        if (!se(A[t], e[t]))
            return !1;
    return !0
}
function Wa(A, e, t, n, r, l) {
    if (yt = l,
    iA = e,
    e.memoizedState = null,
    e.updateQueue = null,
    e.lanes = 0,
    kr.current = A === null || A.memoizedState === null ? Tp : hp,
    A = t(n, r),
    Xn) {
        l = 0;
        do {
            if (Xn = !1,
            Gn = 0,
            25 <= l)
                throw Error(S(301));
            l += 1,
            mA = pA = null,
            e.updateQueue = null,
            kr.current = Mp,
            A = t(n, r)
        } while (Xn)
    }
    if (kr.current = rl,
    e = pA !== null && pA.next !== null,
    yt = 0,
    mA = pA = iA = null,
    nl = !1,
    e)
        throw Error(S(300));
    return A
}
function Za() {
    var A = Gn !== 0;
    return Gn = 0,
    A
}
function fe() {
    var A = {
        memoizedState: null,
        baseState: null,
        baseQueue: null,
        queue: null,
        next: null
    };
    return mA === null ? iA.memoizedState = mA = A : mA = mA.next = A,
    mA
}
function ne() {
    if (pA === null) {
        var A = iA.alternate;
        A = A !== null ? A.memoizedState : null
    } else
        A = pA.next;
    var e = mA === null ? iA.memoizedState : mA.next;
    if (e !== null)
        mA = e,
        pA = A;
    else {
        if (A === null)
            throw Error(S(310));
        pA = A,
        A = {
            memoizedState: pA.memoizedState,
            baseState: pA.baseState,
            baseQueue: pA.baseQueue,
            queue: pA.queue,
            next: null
        },
        mA === null ? iA.memoizedState = mA = A : mA = mA.next = A
    }
    return mA
}
function In(A, e) {
    return typeof e == "function" ? e(A) : e
}
function ri(A) {
    var e = ne()
      , t = e.queue;
    if (t === null)
        throw Error(S(311));
    t.lastRenderedReducer = A;
    var n = pA
      , r = n.baseQueue
      , l = t.pending;
    if (l !== null) {
        if (r !== null) {
            var a = r.next;
            r.next = l.next,
            l.next = a
        }
        n.baseQueue = r = l,
        t.pending = null
    }
    if (r !== null) {
        l = r.next,
        n = n.baseState;
        var u = a = null
          , s = null
          , y = l;
        do {
            var N = y.lane;
            if ((yt & N) === N)
                s !== null && (s = s.next = {
                    lane: 0,
                    action: y.action,
                    hasEagerState: y.hasEagerState,
                    eagerState: y.eagerState,
                    next: null
                }),
                n = y.hasEagerState ? y.eagerState : A(n, y.action);
            else {
                var L = {
                    lane: N,
                    action: y.action,
                    hasEagerState: y.hasEagerState,
                    eagerState: y.eagerState,
                    next: null
                };
                s === null ? (u = s = L,
                a = n) : s = s.next = L,
                iA.lanes |= N,
                vt |= N
            }
            y = y.next
        } while (y !== null && y !== l);
        s === null ? a = n : s.next = u,
        se(n, e.memoizedState) || (UA = !0),
        e.memoizedState = n,
        e.baseState = a,
        e.baseQueue = s,
        t.lastRenderedState = n
    }
    if (A = t.interleaved,
    A !== null) {
        r = A;
        do
            l = r.lane,
            iA.lanes |= l,
            vt |= l,
            r = r.next;
        while (r !== A)
    } else
        r === null && (t.lanes = 0);
    return [e.memoizedState, t.dispatch]
}
function li(A) {
    var e = ne()
      , t = e.queue;
    if (t === null)
        throw Error(S(311));
    t.lastRenderedReducer = A;
    var n = t.dispatch
      , r = t.pending
      , l = e.memoizedState;
    if (r !== null) {
        t.pending = null;
        var a = r = r.next;
        do
            l = A(l, a.action),
            a = a.next;
        while (a !== r);
        se(l, e.memoizedState) || (UA = !0),
        e.memoizedState = l,
        e.baseQueue === null && (e.baseState = l),
        t.lastRenderedState = l
    }
    return [l, n]
}
function rd() {}
function ld(A, e) {
    var t = iA
      , n = ne()
      , r = e()
      , l = !se(n.memoizedState, r);
    if (l && (n.memoizedState = r,
    UA = !0),
    n = n.queue,
    Ra(od.bind(null, t, n, A), [A]),
    n.getSnapshot !== e || l || mA !== null && mA.memoizedState.tag & 1) {
        if (t.flags |= 2048,
        Yn(9, ad.bind(null, t, n, r, e), void 0, null),
        LA === null)
            throw Error(S(349));
        yt & 30 || id(t, e, r)
    }
    return r
}
function id(A, e, t) {
    A.flags |= 16384,
    A = {
        getSnapshot: e,
        value: t
    },
    e = iA.updateQueue,
    e === null ? (e = {
        lastEffect: null,
        stores: null
    },
    iA.updateQueue = e,
    e.stores = [A]) : (t = e.stores,
    t === null ? e.stores = [A] : t.push(A))
}
function ad(A, e, t, n) {
    e.value = t,
    e.getSnapshot = n,
    ud(e) && sd(A)
}
function od(A, e, t) {
    return t(function() {
        ud(e) && sd(A)
    })
}
function ud(A) {
    var e = A.getSnapshot;
    A = A.value;
    try {
        var t = e();
        return !se(A, t)
    } catch {
        return !0
    }
}
function sd(A) {
    var e = be(A, 1);
    e !== null && ue(e, A, 1, -1)
}
function pu(A) {
    var e = fe();
    return typeof A == "function" && (A = A()),
    e.memoizedState = e.baseState = A,
    A = {
        pending: null,
        interleaved: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: In,
        lastRenderedState: A
    },
    e.queue = A,
    A = A.dispatch = Sp.bind(null, iA, A),
    [e.memoizedState, A]
}
function Yn(A, e, t, n) {
    return A = {
        tag: A,
        create: e,
        destroy: t,
        deps: n,
        next: null
    },
    e = iA.updateQueue,
    e === null ? (e = {
        lastEffect: null,
        stores: null
    },
    iA.updateQueue = e,
    e.lastEffect = A.next = A) : (t = e.lastEffect,
    t === null ? e.lastEffect = A.next = A : (n = t.next,
    t.next = A,
    A.next = n,
    e.lastEffect = A)),
    A
}
function dd() {
    return ne().memoizedState
}
function Pr(A, e, t, n) {
    var r = fe();
    iA.flags |= A,
    r.memoizedState = Yn(1 | e, t, void 0, n === void 0 ? null : n)
}
function Nl(A, e, t, n) {
    var r = ne();
    n = n === void 0 ? null : n;
    var l = void 0;
    if (pA !== null) {
        var a = pA.memoizedState;
        if (l = a.destroy,
        n !== null && Ua(n, a.deps)) {
            r.memoizedState = Yn(e, t, l, n);
            return
        }
    }
    iA.flags |= A,
    r.memoizedState = Yn(1 | e, t, l, n)
}
function yu(A, e) {
    return Pr(8390656, 8, A, e)
}
function Ra(A, e) {
    return Nl(2048, 8, A, e)
}
function cd(A, e) {
    return Nl(4, 2, A, e)
}
function fd(A, e) {
    return Nl(4, 4, A, e)
}
function pd(A, e) {
    if (typeof e == "function")
        return A = A(),
        e(A),
        function() {
            e(null)
        }
        ;
    if (e != null)
        return A = A(),
        e.current = A,
        function() {
            e.current = null
        }
}
function yd(A, e, t) {
    return t = t != null ? t.concat([A]) : null,
    Nl(4, 4, pd.bind(null, e, A), t)
}
function Da() {}
function vd(A, e) {
    var t = ne();
    e = e === void 0 ? null : e;
    var n = t.memoizedState;
    return n !== null && e !== null && Ua(e, n[1]) ? n[0] : (t.memoizedState = [A, e],
    A)
}
function md(A, e) {
    var t = ne();
    e = e === void 0 ? null : e;
    var n = t.memoizedState;
    return n !== null && e !== null && Ua(e, n[1]) ? n[0] : (A = A(),
    t.memoizedState = [A, e],
    A)
}
function Ld(A, e, t) {
    return yt & 21 ? (se(t, e) || (t = Ts(),
    iA.lanes |= t,
    vt |= t,
    A.baseState = !0),
    e) : (A.baseState && (A.baseState = !1,
    UA = !0),
    A.memoizedState = t)
}
function jp(A, e) {
    var t = I;
    I = t !== 0 && 4 > t ? t : 4,
    A(!0);
    var n = ni.transition;
    ni.transition = {};
    try {
        A(!1),
        e()
    } finally {
        I = t,
        ni.transition = n
    }
}
function xd() {
    return ne().memoizedState
}
function Np(A, e, t) {
    var n = Ee(A);
    if (t = {
        lane: n,
        action: t,
        hasEagerState: !1,
        eagerState: null,
        next: null
    },
    jd(A))
        Nd(e, t);
    else if (t = ed(A, e, t, n),
    t !== null) {
        var r = qA();
        ue(t, A, n, r),
        Sd(t, e, n)
    }
}
function Sp(A, e, t) {
    var n = Ee(A)
      , r = {
        lane: n,
        action: t,
        hasEagerState: !1,
        eagerState: null,
        next: null
    };
    if (jd(A))
        Nd(e, r);
    else {
        var l = A.alternate;
        if (A.lanes === 0 && (l === null || l.lanes === 0) && (l = e.lastRenderedReducer,
        l !== null))
            try {
                var a = e.lastRenderedState
                  , u = l(a, t);
                if (r.hasEagerState = !0,
                r.eagerState = u,
                se(u, a)) {
                    var s = e.interleaved;
                    s === null ? (r.next = r,
                    qa(e)) : (r.next = s.next,
                    s.next = r),
                    e.interleaved = r;
                    return
                }
            } catch {} finally {}
        t = ed(A, e, r, n),
        t !== null && (r = qA(),
        ue(t, A, n, r),
        Sd(t, e, n))
    }
}
function jd(A) {
    var e = A.alternate;
    return A === iA || e !== null && e === iA
}
function Nd(A, e) {
    Xn = nl = !0;
    var t = A.pending;
    t === null ? e.next = e : (e.next = t.next,
    t.next = e),
    A.pending = e
}
function Sd(A, e, t) {
    if (t & 4194240) {
        var n = e.lanes;
        n &= A.pendingLanes,
        t |= n,
        e.lanes = t,
        ma(A, t)
    }
}
var rl = {
    readContext: te,
    useCallback: bA,
    useContext: bA,
    useEffect: bA,
    useImperativeHandle: bA,
    useInsertionEffect: bA,
    useLayoutEffect: bA,
    useMemo: bA,
    useReducer: bA,
    useRef: bA,
    useState: bA,
    useDebugValue: bA,
    useDeferredValue: bA,
    useTransition: bA,
    useMutableSource: bA,
    useSyncExternalStore: bA,
    useId: bA,
    unstable_isNewReconciler: !1
}
  , Tp = {
    readContext: te,
    useCallback: function(A, e) {
        return fe().memoizedState = [A, e === void 0 ? null : e],
        A
    },
    useContext: te,
    useEffect: yu,
    useImperativeHandle: function(A, e, t) {
        return t = t != null ? t.concat([A]) : null,
        Pr(4194308, 4, pd.bind(null, e, A), t)
    },
    useLayoutEffect: function(A, e) {
        return Pr(4194308, 4, A, e)
    },
    useInsertionEffect: function(A, e) {
        return Pr(4, 2, A, e)
    },
    useMemo: function(A, e) {
        var t = fe();
        return e = e === void 0 ? null : e,
        A = A(),
        t.memoizedState = [A, e],
        A
    },
    useReducer: function(A, e, t) {
        var n = fe();
        return e = t !== void 0 ? t(e) : e,
        n.memoizedState = n.baseState = e,
        A = {
            pending: null,
            interleaved: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: A,
            lastRenderedState: e
        },
        n.queue = A,
        A = A.dispatch = Np.bind(null, iA, A),
        [n.memoizedState, A]
    },
    useRef: function(A) {
        var e = fe();
        return A = {
            current: A
        },
        e.memoizedState = A
    },
    useState: pu,
    useDebugValue: Da,
    useDeferredValue: function(A) {
        return fe().memoizedState = A
    },
    useTransition: function() {
        var A = pu(!1)
          , e = A[0];
        return A = jp.bind(null, A[1]),
        fe().memoizedState = A,
        [e, A]
    },
    useMutableSource: function() {},
    useSyncExternalStore: function(A, e, t) {
        var n = iA
          , r = fe();
        if (eA) {
            if (t === void 0)
                throw Error(S(407));
            t = t()
        } else {
            if (t = e(),
            LA === null)
                throw Error(S(349));
            yt & 30 || id(n, e, t)
        }
        r.memoizedState = t;
        var l = {
            value: t,
            getSnapshot: e
        };
        return r.queue = l,
        yu(od.bind(null, n, l, A), [A]),
        n.flags |= 2048,
        Yn(9, ad.bind(null, n, l, t, e), void 0, null),
        t
    },
    useId: function() {
        var A = fe()
          , e = LA.identifierPrefix;
        if (eA) {
            var t = Se
              , n = Ne;
            t = (n & ~(1 << 32 - oe(n) - 1)).toString(32) + t,
            e = ":" + e + "R" + t,
            t = Gn++,
            0 < t && (e += "H" + t.toString(32)),
            e += ":"
        } else
            t = xp++,
            e = ":" + e + "r" + t.toString(32) + ":";
        return A.memoizedState = e
    },
    unstable_isNewReconciler: !1
}
  , hp = {
    readContext: te,
    useCallback: vd,
    useContext: te,
    useEffect: Ra,
    useImperativeHandle: yd,
    useInsertionEffect: cd,
    useLayoutEffect: fd,
    useMemo: md,
    useReducer: ri,
    useRef: dd,
    useState: function() {
        return ri(In)
    },
    useDebugValue: Da,
    useDeferredValue: function(A) {
        var e = ne();
        return Ld(e, pA.memoizedState, A)
    },
    useTransition: function() {
        var A = ri(In)[0]
          , e = ne().memoizedState;
        return [A, e]
    },
    useMutableSource: rd,
    useSyncExternalStore: ld,
    useId: xd,
    unstable_isNewReconciler: !1
}
  , Mp = {
    readContext: te,
    useCallback: vd,
    useContext: te,
    useEffect: Ra,
    useImperativeHandle: yd,
    useInsertionEffect: cd,
    useLayoutEffect: fd,
    useMemo: md,
    useReducer: li,
    useRef: dd,
    useState: function() {
        return li(In)
    },
    useDebugValue: Da,
    useDeferredValue: function(A) {
        var e = ne();
        return pA === null ? e.memoizedState = A : Ld(e, pA.memoizedState, A)
    },
    useTransition: function() {
        var A = li(In)[0]
          , e = ne().memoizedState;
        return [A, e]
    },
    useMutableSource: rd,
    useSyncExternalStore: ld,
    useId: xd,
    unstable_isNewReconciler: !1
};
function le(A, e) {
    if (A && A.defaultProps) {
        e = aA({}, e),
        A = A.defaultProps;
        for (var t in A)
            e[t] === void 0 && (e[t] = A[t]);
        return e
    }
    return e
}
function Ji(A, e, t, n) {
    e = A.memoizedState,
    t = t(n, e),
    t = t == null ? e : aA({}, e, t),
    A.memoizedState = t,
    A.lanes === 0 && (A.updateQueue.baseState = t)
}
var Sl = {
    isMounted: function(A) {
        return (A = A._reactInternals) ? xt(A) === A : !1
    },
    enqueueSetState: function(A, e, t) {
        A = A._reactInternals;
        var n = qA()
          , r = Ee(A)
          , l = Te(n, r);
        l.payload = e,
        t != null && (l.callback = t),
        e = Je(A, l, r),
        e !== null && (ue(e, A, r, n),
        Or(e, A, r))
    },
    enqueueReplaceState: function(A, e, t) {
        A = A._reactInternals;
        var n = qA()
          , r = Ee(A)
          , l = Te(n, r);
        l.tag = 1,
        l.payload = e,
        t != null && (l.callback = t),
        e = Je(A, l, r),
        e !== null && (ue(e, A, r, n),
        Or(e, A, r))
    },
    enqueueForceUpdate: function(A, e) {
        A = A._reactInternals;
        var t = qA()
          , n = Ee(A)
          , r = Te(t, n);
        r.tag = 2,
        e != null && (r.callback = e),
        e = Je(A, r, n),
        e !== null && (ue(e, A, n, t),
        Or(e, A, n))
    }
};
function vu(A, e, t, n, r, l, a) {
    return A = A.stateNode,
    typeof A.shouldComponentUpdate == "function" ? A.shouldComponentUpdate(n, l, a) : e.prototype && e.prototype.isPureReactComponent ? !Hn(t, n) || !Hn(r, l) : !0
}
function Td(A, e, t) {
    var n = !1
      , r = Ge
      , l = e.contextType;
    return typeof l == "object" && l !== null ? l = te(l) : (r = ZA(e) ? ft : VA.current,
    n = e.contextTypes,
    l = (n = n != null) ? It(A, r) : Ge),
    e = new e(t,l),
    A.memoizedState = e.state !== null && e.state !== void 0 ? e.state : null,
    e.updater = Sl,
    A.stateNode = e,
    e._reactInternals = A,
    n && (A = A.stateNode,
    A.__reactInternalMemoizedUnmaskedChildContext = r,
    A.__reactInternalMemoizedMaskedChildContext = l),
    e
}
function mu(A, e, t, n) {
    A = e.state,
    typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(t, n),
    typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(t, n),
    e.state !== A && Sl.enqueueReplaceState(e, e.state, null)
}
function Ki(A, e, t, n) {
    var r = A.stateNode;
    r.props = t,
    r.state = A.memoizedState,
    r.refs = {},
    Oa(A);
    var l = e.contextType;
    typeof l == "object" && l !== null ? r.context = te(l) : (l = ZA(e) ? ft : VA.current,
    r.context = It(A, l)),
    r.state = A.memoizedState,
    l = e.getDerivedStateFromProps,
    typeof l == "function" && (Ji(A, e, l, t),
    r.state = A.memoizedState),
    typeof e.getDerivedStateFromProps == "function" || typeof r.getSnapshotBeforeUpdate == "function" || typeof r.UNSAFE_componentWillMount != "function" && typeof r.componentWillMount != "function" || (e = r.state,
    typeof r.componentWillMount == "function" && r.componentWillMount(),
    typeof r.UNSAFE_componentWillMount == "function" && r.UNSAFE_componentWillMount(),
    e !== r.state && Sl.enqueueReplaceState(r, r.state, null),
    el(A, t, r, n),
    r.state = A.memoizedState),
    typeof r.componentDidMount == "function" && (A.flags |= 4194308)
}
function _t(A, e) {
    try {
        var t = ""
          , n = e;
        do
            t += _c(n),
            n = n.return;
        while (n);
        var r = t
    } catch (l) {
        r = `
Error generating stack: ` + l.message + `
` + l.stack
    }
    return {
        value: A,
        source: e,
        stack: r,
        digest: null
    }
}
function ii(A, e, t) {
    return {
        value: A,
        source: null,
        stack: t ?? null,
        digest: e ?? null
    }
}
function Ei(A, e) {
    try {
        console.error(e.value)
    } catch (t) {
        setTimeout(function() {
            throw t
        })
    }
}
var bp = typeof WeakMap == "function" ? WeakMap : Map;
function hd(A, e, t) {
    t = Te(-1, t),
    t.tag = 3,
    t.payload = {
        element: null
    };
    var n = e.value;
    return t.callback = function() {
        il || (il = !0,
        Aa = n),
        Ei(A, e)
    }
    ,
    t
}
function Md(A, e, t) {
    t = Te(-1, t),
    t.tag = 3;
    var n = A.type.getDerivedStateFromError;
    if (typeof n == "function") {
        var r = e.value;
        t.payload = function() {
            return n(r)
        }
        ,
        t.callback = function() {
            Ei(A, e)
        }
    }
    var l = A.stateNode;
    return l !== null && typeof l.componentDidCatch == "function" && (t.callback = function() {
        Ei(A, e),
        typeof n != "function" && (Ke === null ? Ke = new Set([this]) : Ke.add(this));
        var a = e.stack;
        this.componentDidCatch(e.value, {
            componentStack: a !== null ? a : ""
        })
    }
    ),
    t
}
function Lu(A, e, t) {
    var n = A.pingCache;
    if (n === null) {
        n = A.pingCache = new bp;
        var r = new Set;
        n.set(e, r)
    } else
        r = n.get(e),
        r === void 0 && (r = new Set,
        n.set(e, r));
    r.has(t) || (r.add(t),
    A = Dp.bind(null, A, e, t),
    e.then(A, A))
}
function xu(A) {
    do {
        var e;
        if ((e = A.tag === 13) && (e = A.memoizedState,
        e = e !== null ? e.dehydrated !== null : !0),
        e)
            return A;
        A = A.return
    } while (A !== null);
    return null
}
function ju(A, e, t, n, r) {
    return A.mode & 1 ? (A.flags |= 65536,
    A.lanes = r,
    A) : (A === e ? A.flags |= 65536 : (A.flags |= 128,
    t.flags |= 131072,
    t.flags &= -52805,
    t.tag === 1 && (t.alternate === null ? t.tag = 17 : (e = Te(-1, 1),
    e.tag = 2,
    Je(t, e, 1))),
    t.lanes |= 1),
    A)
}
var zp = ge.ReactCurrentOwner
  , UA = !1;
function XA(A, e, t, n) {
    e.child = A === null ? Ad(e, null, t, n) : Bt(e, A.child, t, n)
}
function Nu(A, e, t, n, r) {
    t = t.render;
    var l = e.ref;
    return Ft(e, r),
    n = Wa(A, e, t, n, l, r),
    t = Za(),
    A !== null && !UA ? (e.updateQueue = A.updateQueue,
    e.flags &= -2053,
    A.lanes &= ~r,
    ze(A, e, r)) : (eA && t && Ma(e),
    e.flags |= 1,
    XA(A, e, n, r),
    e.child)
}
function Su(A, e, t, n, r) {
    if (A === null) {
        var l = t.type;
        return typeof l == "function" && !Ia(l) && l.defaultProps === void 0 && t.compare === null && t.defaultProps === void 0 ? (e.tag = 15,
        e.type = l,
        bd(A, e, l, n, r)) : (A = Zr(t.type, null, n, e, e.mode, r),
        A.ref = e.ref,
        A.return = e,
        e.child = A)
    }
    if (l = A.child,
    !(A.lanes & r)) {
        var a = l.memoizedProps;
        if (t = t.compare,
        t = t !== null ? t : Hn,
        t(a, n) && A.ref === e.ref)
            return ze(A, e, r)
    }
    return e.flags |= 1,
    A = Fe(l, n),
    A.ref = e.ref,
    A.return = e,
    e.child = A
}
function bd(A, e, t, n, r) {
    if (A !== null) {
        var l = A.memoizedProps;
        if (Hn(l, n) && A.ref === e.ref)
            if (UA = !1,
            e.pendingProps = n = l,
            (A.lanes & r) !== 0)
                A.flags & 131072 && (UA = !0);
            else
                return e.lanes = A.lanes,
                ze(A, e, r)
    }
    return Fi(A, e, t, n, r)
}
function zd(A, e, t) {
    var n = e.pendingProps
      , r = n.children
      , l = A !== null ? A.memoizedState : null;
    if (n.mode === "hidden")
        if (!(e.mode & 1))
            e.memoizedState = {
                baseLanes: 0,
                cachePool: null,
                transitions: null
            },
            Q(Dt, KA),
            KA |= t;
        else {
            if (!(t & 1073741824))
                return A = l !== null ? l.baseLanes | t : t,
                e.lanes = e.childLanes = 1073741824,
                e.memoizedState = {
                    baseLanes: A,
                    cachePool: null,
                    transitions: null
                },
                e.updateQueue = null,
                Q(Dt, KA),
                KA |= A,
                null;
            e.memoizedState = {
                baseLanes: 0,
                cachePool: null,
                transitions: null
            },
            n = l !== null ? l.baseLanes : t,
            Q(Dt, KA),
            KA |= n
        }
    else
        l !== null ? (n = l.baseLanes | t,
        e.memoizedState = null) : n = t,
        Q(Dt, KA),
        KA |= n;
    return XA(A, e, r, t),
    e.child
}
function gd(A, e) {
    var t = e.ref;
    (A === null && t !== null || A !== null && A.ref !== t) && (e.flags |= 512,
    e.flags |= 2097152)
}
function Fi(A, e, t, n, r) {
    var l = ZA(t) ? ft : VA.current;
    return l = It(e, l),
    Ft(e, r),
    t = Wa(A, e, t, n, l, r),
    n = Za(),
    A !== null && !UA ? (e.updateQueue = A.updateQueue,
    e.flags &= -2053,
    A.lanes &= ~r,
    ze(A, e, r)) : (eA && n && Ma(e),
    e.flags |= 1,
    XA(A, e, t, r),
    e.child)
}
function Tu(A, e, t, n, r) {
    if (ZA(t)) {
        var l = !0;
        Br(e)
    } else
        l = !1;
    if (Ft(e, r),
    e.stateNode === null)
        wr(A, e),
        Td(e, t, n),
        Ki(e, t, n, r),
        n = !0;
    else if (A === null) {
        var a = e.stateNode
          , u = e.memoizedProps;
        a.props = u;
        var s = a.context
          , y = t.contextType;
        typeof y == "object" && y !== null ? y = te(y) : (y = ZA(t) ? ft : VA.current,
        y = It(e, y));
        var N = t.getDerivedStateFromProps
          , L = typeof N == "function" || typeof a.getSnapshotBeforeUpdate == "function";
        L || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (u !== n || s !== y) && mu(e, a, n, y),
        ke = !1;
        var m = e.memoizedState;
        a.state = m,
        el(e, n, a, r),
        s = e.memoizedState,
        u !== n || m !== s || WA.current || ke ? (typeof N == "function" && (Ji(e, t, N, n),
        s = e.memoizedState),
        (u = ke || vu(e, t, u, n, m, s, y)) ? (L || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (typeof a.componentWillMount == "function" && a.componentWillMount(),
        typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount()),
        typeof a.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof a.componentDidMount == "function" && (e.flags |= 4194308),
        e.memoizedProps = n,
        e.memoizedState = s),
        a.props = n,
        a.state = s,
        a.context = y,
        n = u) : (typeof a.componentDidMount == "function" && (e.flags |= 4194308),
        n = !1)
    } else {
        a = e.stateNode,
        td(A, e),
        u = e.memoizedProps,
        y = e.type === e.elementType ? u : le(e.type, u),
        a.props = y,
        L = e.pendingProps,
        m = a.context,
        s = t.contextType,
        typeof s == "object" && s !== null ? s = te(s) : (s = ZA(t) ? ft : VA.current,
        s = It(e, s));
        var h = t.getDerivedStateFromProps;
        (N = typeof h == "function" || typeof a.getSnapshotBeforeUpdate == "function") || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (u !== L || m !== s) && mu(e, a, n, s),
        ke = !1,
        m = e.memoizedState,
        a.state = m,
        el(e, n, a, r);
        var T = e.memoizedState;
        u !== L || m !== T || WA.current || ke ? (typeof h == "function" && (Ji(e, t, h, n),
        T = e.memoizedState),
        (y = ke || vu(e, t, y, n, m, T, s) || !1) ? (N || typeof a.UNSAFE_componentWillUpdate != "function" && typeof a.componentWillUpdate != "function" || (typeof a.componentWillUpdate == "function" && a.componentWillUpdate(n, T, s),
        typeof a.UNSAFE_componentWillUpdate == "function" && a.UNSAFE_componentWillUpdate(n, T, s)),
        typeof a.componentDidUpdate == "function" && (e.flags |= 4),
        typeof a.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof a.componentDidUpdate != "function" || u === A.memoizedProps && m === A.memoizedState || (e.flags |= 4),
        typeof a.getSnapshotBeforeUpdate != "function" || u === A.memoizedProps && m === A.memoizedState || (e.flags |= 1024),
        e.memoizedProps = n,
        e.memoizedState = T),
        a.props = n,
        a.state = T,
        a.context = s,
        n = y) : (typeof a.componentDidUpdate != "function" || u === A.memoizedProps && m === A.memoizedState || (e.flags |= 4),
        typeof a.getSnapshotBeforeUpdate != "function" || u === A.memoizedProps && m === A.memoizedState || (e.flags |= 1024),
        n = !1)
    }
    return Ci(A, e, t, n, l, r)
}
function Ci(A, e, t, n, r, l) {
    gd(A, e);
    var a = (e.flags & 128) !== 0;
    if (!n && !a)
        return r && ou(e, t, !1),
        ze(A, e, l);
    n = e.stateNode,
    zp.current = e;
    var u = a && typeof t.getDerivedStateFromError != "function" ? null : n.render();
    return e.flags |= 1,
    A !== null && a ? (e.child = Bt(e, A.child, null, l),
    e.child = Bt(e, null, u, l)) : XA(A, e, u, l),
    e.memoizedState = n.state,
    r && ou(e, t, !0),
    e.child
}
function Vd(A) {
    var e = A.stateNode;
    e.pendingContext ? au(A, e.pendingContext, e.pendingContext !== e.context) : e.context && au(A, e.context, !1),
    ka(A, e.containerInfo)
}
function hu(A, e, t, n, r) {
    return Yt(),
    za(r),
    e.flags |= 256,
    XA(A, e, t, n),
    e.child
}
var Gi = {
    dehydrated: null,
    treeContext: null,
    retryLane: 0
};
function Ii(A) {
    return {
        baseLanes: A,
        cachePool: null,
        transitions: null
    }
}
function Xd(A, e, t) {
    var n = e.pendingProps, r = lA.current, l = !1, a = (e.flags & 128) !== 0, u;
    if ((u = a) || (u = A !== null && A.memoizedState === null ? !1 : (r & 2) !== 0),
    u ? (l = !0,
    e.flags &= -129) : (A === null || A.memoizedState !== null) && (r |= 1),
    Q(lA, r & 1),
    A === null)
        return Di(e),
        A = e.memoizedState,
        A !== null && (A = A.dehydrated,
        A !== null) ? (e.mode & 1 ? A.data === "$!" ? e.lanes = 8 : e.lanes = 1073741824 : e.lanes = 1,
        null) : (a = n.children,
        A = n.fallback,
        l ? (n = e.mode,
        l = e.child,
        a = {
            mode: "hidden",
            children: a
        },
        !(n & 1) && l !== null ? (l.childLanes = 0,
        l.pendingProps = a) : l = Ml(a, n, 0, null),
        A = ct(A, n, t, null),
        l.return = e,
        A.return = e,
        l.sibling = A,
        e.child = l,
        e.child.memoizedState = Ii(t),
        e.memoizedState = Gi,
        A) : Ha(e, a));
    if (r = A.memoizedState,
    r !== null && (u = r.dehydrated,
    u !== null))
        return gp(A, e, a, n, u, r, t);
    if (l) {
        l = n.fallback,
        a = e.mode,
        r = A.child,
        u = r.sibling;
        var s = {
            mode: "hidden",
            children: n.children
        };
        return !(a & 1) && e.child !== r ? (n = e.child,
        n.childLanes = 0,
        n.pendingProps = s,
        e.deletions = null) : (n = Fe(r, s),
        n.subtreeFlags = r.subtreeFlags & 14680064),
        u !== null ? l = Fe(u, l) : (l = ct(l, a, t, null),
        l.flags |= 2),
        l.return = e,
        n.return = e,
        n.sibling = l,
        e.child = n,
        n = l,
        l = e.child,
        a = A.child.memoizedState,
        a = a === null ? Ii(t) : {
            baseLanes: a.baseLanes | t,
            cachePool: null,
            transitions: a.transitions
        },
        l.memoizedState = a,
        l.childLanes = A.childLanes & ~t,
        e.memoizedState = Gi,
        n
    }
    return l = A.child,
    A = l.sibling,
    n = Fe(l, {
        mode: "visible",
        children: n.children
    }),
    !(e.mode & 1) && (n.lanes = t),
    n.return = e,
    n.sibling = null,
    A !== null && (t = e.deletions,
    t === null ? (e.deletions = [A],
    e.flags |= 16) : t.push(A)),
    e.child = n,
    e.memoizedState = null,
    n
}
function Ha(A, e) {
    return e = Ml({
        mode: "visible",
        children: e
    }, A.mode, 0, null),
    e.return = A,
    A.child = e
}
function Nr(A, e, t, n) {
    return n !== null && za(n),
    Bt(e, A.child, null, t),
    A = Ha(e, e.pendingProps.children),
    A.flags |= 2,
    e.memoizedState = null,
    A
}
function gp(A, e, t, n, r, l, a) {
    if (t)
        return e.flags & 256 ? (e.flags &= -257,
        n = ii(Error(S(422))),
        Nr(A, e, a, n)) : e.memoizedState !== null ? (e.child = A.child,
        e.flags |= 128,
        null) : (l = n.fallback,
        r = e.mode,
        n = Ml({
            mode: "visible",
            children: n.children
        }, r, 0, null),
        l = ct(l, r, a, null),
        l.flags |= 2,
        n.return = e,
        l.return = e,
        n.sibling = l,
        e.child = n,
        e.mode & 1 && Bt(e, A.child, null, a),
        e.child.memoizedState = Ii(a),
        e.memoizedState = Gi,
        l);
    if (!(e.mode & 1))
        return Nr(A, e, a, null);
    if (r.data === "$!") {
        if (n = r.nextSibling && r.nextSibling.dataset,
        n)
            var u = n.dgst;
        return n = u,
        l = Error(S(419)),
        n = ii(l, n, void 0),
        Nr(A, e, a, n)
    }
    if (u = (a & A.childLanes) !== 0,
    UA || u) {
        if (n = LA,
        n !== null) {
            switch (a & -a) {
            case 4:
                r = 2;
                break;
            case 16:
                r = 8;
                break;
            case 64:
            case 128:
            case 256:
            case 512:
            case 1024:
            case 2048:
            case 4096:
            case 8192:
            case 16384:
            case 32768:
            case 65536:
            case 131072:
            case 262144:
            case 524288:
            case 1048576:
            case 2097152:
            case 4194304:
            case 8388608:
            case 16777216:
            case 33554432:
            case 67108864:
                r = 32;
                break;
            case 536870912:
                r = 268435456;
                break;
            default:
                r = 0
            }
            r = r & (n.suspendedLanes | a) ? 0 : r,
            r !== 0 && r !== l.retryLane && (l.retryLane = r,
            be(A, r),
            ue(n, A, r, -1))
        }
        return Ga(),
        n = ii(Error(S(421))),
        Nr(A, e, a, n)
    }
    return r.data === "$?" ? (e.flags |= 128,
    e.child = A.child,
    e = Hp.bind(null, A),
    r._reactRetry = e,
    null) : (A = l.treeContext,
    EA = He(r.nextSibling),
    FA = e,
    eA = !0,
    ae = null,
    A !== null && (_A[$A++] = Ne,
    _A[$A++] = Se,
    _A[$A++] = pt,
    Ne = A.id,
    Se = A.overflow,
    pt = e),
    e = Ha(e, n.children),
    e.flags |= 4096,
    e)
}
function Mu(A, e, t) {
    A.lanes |= e;
    var n = A.alternate;
    n !== null && (n.lanes |= e),
    Hi(A.return, e, t)
}
function ai(A, e, t, n, r) {
    var l = A.memoizedState;
    l === null ? A.memoizedState = {
        isBackwards: e,
        rendering: null,
        renderingStartTime: 0,
        last: n,
        tail: t,
        tailMode: r
    } : (l.isBackwards = e,
    l.rendering = null,
    l.renderingStartTime = 0,
    l.last = n,
    l.tail = t,
    l.tailMode = r)
}
function qd(A, e, t) {
    var n = e.pendingProps
      , r = n.revealOrder
      , l = n.tail;
    if (XA(A, e, n.children, t),
    n = lA.current,
    n & 2)
        n = n & 1 | 2,
        e.flags |= 128;
    else {
        if (A !== null && A.flags & 128)
            A: for (A = e.child; A !== null; ) {
                if (A.tag === 13)
                    A.memoizedState !== null && Mu(A, t, e);
                else if (A.tag === 19)
                    Mu(A, t, e);
                else if (A.child !== null) {
                    A.child.return = A,
                    A = A.child;
                    continue
                }
                if (A === e)
                    break A;
                for (; A.sibling === null; ) {
                    if (A.return === null || A.return === e)
                        break A;
                    A = A.return
                }
                A.sibling.return = A.return,
                A = A.sibling
            }
        n &= 1
    }
    if (Q(lA, n),
    !(e.mode & 1))
        e.memoizedState = null;
    else
        switch (r) {
        case "forwards":
            for (t = e.child,
            r = null; t !== null; )
                A = t.alternate,
                A !== null && tl(A) === null && (r = t),
                t = t.sibling;
            t = r,
            t === null ? (r = e.child,
            e.child = null) : (r = t.sibling,
            t.sibling = null),
            ai(e, !1, r, t, l);
            break;
        case "backwards":
            for (t = null,
            r = e.child,
            e.child = null; r !== null; ) {
                if (A = r.alternate,
                A !== null && tl(A) === null) {
                    e.child = r;
                    break
                }
                A = r.sibling,
                r.sibling = t,
                t = r,
                r = A
            }
            ai(e, !0, t, null, l);
            break;
        case "together":
            ai(e, !1, null, null, void 0);
            break;
        default:
            e.memoizedState = null
        }
    return e.child
}
function wr(A, e) {
    !(e.mode & 1) && A !== null && (A.alternate = null,
    e.alternate = null,
    e.flags |= 2)
}
function ze(A, e, t) {
    if (A !== null && (e.dependencies = A.dependencies),
    vt |= e.lanes,
    !(t & e.childLanes))
        return null;
    if (A !== null && e.child !== A.child)
        throw Error(S(153));
    if (e.child !== null) {
        for (A = e.child,
        t = Fe(A, A.pendingProps),
        e.child = t,
        t.return = e; A.sibling !== null; )
            A = A.sibling,
            t = t.sibling = Fe(A, A.pendingProps),
            t.return = e;
        t.sibling = null
    }
    return e.child
}
function Vp(A, e, t) {
    switch (e.tag) {
    case 3:
        Vd(e),
        Yt();
        break;
    case 5:
        nd(e);
        break;
    case 1:
        ZA(e.type) && Br(e);
        break;
    case 4:
        ka(e, e.stateNode.containerInfo);
        break;
    case 10:
        var n = e.type._context
          , r = e.memoizedProps.value;
        Q($r, n._currentValue),
        n._currentValue = r;
        break;
    case 13:
        if (n = e.memoizedState,
        n !== null)
            return n.dehydrated !== null ? (Q(lA, lA.current & 1),
            e.flags |= 128,
            null) : t & e.child.childLanes ? Xd(A, e, t) : (Q(lA, lA.current & 1),
            A = ze(A, e, t),
            A !== null ? A.sibling : null);
        Q(lA, lA.current & 1);
        break;
    case 19:
        if (n = (t & e.childLanes) !== 0,
        A.flags & 128) {
            if (n)
                return qd(A, e, t);
            e.flags |= 128
        }
        if (r = e.memoizedState,
        r !== null && (r.rendering = null,
        r.tail = null,
        r.lastEffect = null),
        Q(lA, lA.current),
        n)
            break;
        return null;
    case 22:
    case 23:
        return e.lanes = 0,
        zd(A, e, t)
    }
    return ze(A, e, t)
}
var Od, Yi, kd, Pd;
Od = function(A, e) {
    for (var t = e.child; t !== null; ) {
        if (t.tag === 5 || t.tag === 6)
            A.appendChild(t.stateNode);
        else if (t.tag !== 4 && t.child !== null) {
            t.child.return = t,
            t = t.child;
            continue
        }
        if (t === e)
            break;
        for (; t.sibling === null; ) {
            if (t.return === null || t.return === e)
                return;
            t = t.return
        }
        t.sibling.return = t.return,
        t = t.sibling
    }
}
;
Yi = function() {}
;
kd = function(A, e, t, n) {
    var r = A.memoizedProps;
    if (r !== n) {
        A = e.stateNode,
        st(ve.current);
        var l = null;
        switch (t) {
        case "input":
            r = mi(A, r),
            n = mi(A, n),
            l = [];
            break;
        case "select":
            r = aA({}, r, {
                value: void 0
            }),
            n = aA({}, n, {
                value: void 0
            }),
            l = [];
            break;
        case "textarea":
            r = ji(A, r),
            n = ji(A, n),
            l = [];
            break;
        default:
            typeof r.onClick != "function" && typeof n.onClick == "function" && (A.onclick = Ir)
        }
        Si(t, n);
        var a;
        t = null;
        for (y in r)
            if (!n.hasOwnProperty(y) && r.hasOwnProperty(y) && r[y] != null)
                if (y === "style") {
                    var u = r[y];
                    for (a in u)
                        u.hasOwnProperty(a) && (t || (t = {}),
                        t[a] = "")
                } else
                    y !== "dangerouslySetInnerHTML" && y !== "children" && y !== "suppressContentEditableWarning" && y !== "suppressHydrationWarning" && y !== "autoFocus" && (Pn.hasOwnProperty(y) ? l || (l = []) : (l = l || []).push(y, null));
        for (y in n) {
            var s = n[y];
            if (u = r != null ? r[y] : void 0,
            n.hasOwnProperty(y) && s !== u && (s != null || u != null))
                if (y === "style")
                    if (u) {
                        for (a in u)
                            !u.hasOwnProperty(a) || s && s.hasOwnProperty(a) || (t || (t = {}),
                            t[a] = "");
                        for (a in s)
                            s.hasOwnProperty(a) && u[a] !== s[a] && (t || (t = {}),
                            t[a] = s[a])
                    } else
                        t || (l || (l = []),
                        l.push(y, t)),
                        t = s;
                else
                    y === "dangerouslySetInnerHTML" ? (s = s ? s.__html : void 0,
                    u = u ? u.__html : void 0,
                    s != null && u !== s && (l = l || []).push(y, s)) : y === "children" ? typeof s != "string" && typeof s != "number" || (l = l || []).push(y, "" + s) : y !== "suppressContentEditableWarning" && y !== "suppressHydrationWarning" && (Pn.hasOwnProperty(y) ? (s != null && y === "onScroll" && $("scroll", A),
                    l || u === s || (l = [])) : (l = l || []).push(y, s))
        }
        t && (l = l || []).push("style", t);
        var y = l;
        (e.updateQueue = y) && (e.flags |= 4)
    }
}
;
Pd = function(A, e, t, n) {
    t !== n && (e.flags |= 4)
}
;
function vn(A, e) {
    if (!eA)
        switch (A.tailMode) {
        case "hidden":
            e = A.tail;
            for (var t = null; e !== null; )
                e.alternate !== null && (t = e),
                e = e.sibling;
            t === null ? A.tail = null : t.sibling = null;
            break;
        case "collapsed":
            t = A.tail;
            for (var n = null; t !== null; )
                t.alternate !== null && (n = t),
                t = t.sibling;
            n === null ? e || A.tail === null ? A.tail = null : A.tail.sibling = null : n.sibling = null
        }
}
function zA(A) {
    var e = A.alternate !== null && A.alternate.child === A.child
      , t = 0
      , n = 0;
    if (e)
        for (var r = A.child; r !== null; )
            t |= r.lanes | r.childLanes,
            n |= r.subtreeFlags & 14680064,
            n |= r.flags & 14680064,
            r.return = A,
            r = r.sibling;
    else
        for (r = A.child; r !== null; )
            t |= r.lanes | r.childLanes,
            n |= r.subtreeFlags,
            n |= r.flags,
            r.return = A,
            r = r.sibling;
    return A.subtreeFlags |= n,
    A.childLanes = t,
    e
}
function Xp(A, e, t) {
    var n = e.pendingProps;
    switch (ba(e),
    e.tag) {
    case 2:
    case 16:
    case 15:
    case 0:
    case 11:
    case 7:
    case 8:
    case 12:
    case 9:
    case 14:
        return zA(e),
        null;
    case 1:
        return ZA(e.type) && Yr(),
        zA(e),
        null;
    case 3:
        return n = e.stateNode,
        Qt(),
        AA(WA),
        AA(VA),
        wa(),
        n.pendingContext && (n.context = n.pendingContext,
        n.pendingContext = null),
        (A === null || A.child === null) && (xr(e) ? e.flags |= 4 : A === null || A.memoizedState.isDehydrated && !(e.flags & 256) || (e.flags |= 1024,
        ae !== null && (na(ae),
        ae = null))),
        Yi(A, e),
        zA(e),
        null;
    case 5:
        Pa(e);
        var r = st(Cn.current);
        if (t = e.type,
        A !== null && e.stateNode != null)
            kd(A, e, t, n, r),
            A.ref !== e.ref && (e.flags |= 512,
            e.flags |= 2097152);
        else {
            if (!n) {
                if (e.stateNode === null)
                    throw Error(S(166));
                return zA(e),
                null
            }
            if (A = st(ve.current),
            xr(e)) {
                n = e.stateNode,
                t = e.type;
                var l = e.memoizedProps;
                switch (n[pe] = e,
                n[En] = l,
                A = (e.mode & 1) !== 0,
                t) {
                case "dialog":
                    $("cancel", n),
                    $("close", n);
                    break;
                case "iframe":
                case "object":
                case "embed":
                    $("load", n);
                    break;
                case "video":
                case "audio":
                    for (r = 0; r < Sn.length; r++)
                        $(Sn[r], n);
                    break;
                case "source":
                    $("error", n);
                    break;
                case "img":
                case "image":
                case "link":
                    $("error", n),
                    $("load", n);
                    break;
                case "details":
                    $("toggle", n);
                    break;
                case "input":
                    Po(n, l),
                    $("invalid", n);
                    break;
                case "select":
                    n._wrapperState = {
                        wasMultiple: !!l.multiple
                    },
                    $("invalid", n);
                    break;
                case "textarea":
                    Uo(n, l),
                    $("invalid", n)
                }
                Si(t, l),
                r = null;
                for (var a in l)
                    if (l.hasOwnProperty(a)) {
                        var u = l[a];
                        a === "children" ? typeof u == "string" ? n.textContent !== u && (l.suppressHydrationWarning !== !0 && Lr(n.textContent, u, A),
                        r = ["children", u]) : typeof u == "number" && n.textContent !== "" + u && (l.suppressHydrationWarning !== !0 && Lr(n.textContent, u, A),
                        r = ["children", "" + u]) : Pn.hasOwnProperty(a) && u != null && a === "onScroll" && $("scroll", n)
                    }
                switch (t) {
                case "input":
                    sr(n),
                    wo(n, l, !0);
                    break;
                case "textarea":
                    sr(n),
                    Wo(n);
                    break;
                case "select":
                case "option":
                    break;
                default:
                    typeof l.onClick == "function" && (n.onclick = Ir)
                }
                n = r,
                e.updateQueue = n,
                n !== null && (e.flags |= 4)
            } else {
                a = r.nodeType === 9 ? r : r.ownerDocument,
                A === "http://www.w3.org/1999/xhtml" && (A = os(t)),
                A === "http://www.w3.org/1999/xhtml" ? t === "script" ? (A = a.createElement("div"),
                A.innerHTML = "<script><\/script>",
                A = A.removeChild(A.firstChild)) : typeof n.is == "string" ? A = a.createElement(t, {
                    is: n.is
                }) : (A = a.createElement(t),
                t === "select" && (a = A,
                n.multiple ? a.multiple = !0 : n.size && (a.size = n.size))) : A = a.createElementNS(A, t),
                A[pe] = e,
                A[En] = n,
                Od(A, e, !1, !1),
                e.stateNode = A;
                A: {
                    switch (a = Ti(t, n),
                    t) {
                    case "dialog":
                        $("cancel", A),
                        $("close", A),
                        r = n;
                        break;
                    case "iframe":
                    case "object":
                    case "embed":
                        $("load", A),
                        r = n;
                        break;
                    case "video":
                    case "audio":
                        for (r = 0; r < Sn.length; r++)
                            $(Sn[r], A);
                        r = n;
                        break;
                    case "source":
                        $("error", A),
                        r = n;
                        break;
                    case "img":
                    case "image":
                    case "link":
                        $("error", A),
                        $("load", A),
                        r = n;
                        break;
                    case "details":
                        $("toggle", A),
                        r = n;
                        break;
                    case "input":
                        Po(A, n),
                        r = mi(A, n),
                        $("invalid", A);
                        break;
                    case "option":
                        r = n;
                        break;
                    case "select":
                        A._wrapperState = {
                            wasMultiple: !!n.multiple
                        },
                        r = aA({}, n, {
                            value: void 0
                        }),
                        $("invalid", A);
                        break;
                    case "textarea":
                        Uo(A, n),
                        r = ji(A, n),
                        $("invalid", A);
                        break;
                    default:
                        r = n
                    }
                    Si(t, r),
                    u = r;
                    for (l in u)
                        if (u.hasOwnProperty(l)) {
                            var s = u[l];
                            l === "style" ? ds(A, s) : l === "dangerouslySetInnerHTML" ? (s = s ? s.__html : void 0,
                            s != null && us(A, s)) : l === "children" ? typeof s == "string" ? (t !== "textarea" || s !== "") && wn(A, s) : typeof s == "number" && wn(A, "" + s) : l !== "suppressContentEditableWarning" && l !== "suppressHydrationWarning" && l !== "autoFocus" && (Pn.hasOwnProperty(l) ? s != null && l === "onScroll" && $("scroll", A) : s != null && da(A, l, s, a))
                        }
                    switch (t) {
                    case "input":
                        sr(A),
                        wo(A, n, !1);
                        break;
                    case "textarea":
                        sr(A),
                        Wo(A);
                        break;
                    case "option":
                        n.value != null && A.setAttribute("value", "" + Ce(n.value));
                        break;
                    case "select":
                        A.multiple = !!n.multiple,
                        l = n.value,
                        l != null ? Ht(A, !!n.multiple, l, !1) : n.defaultValue != null && Ht(A, !!n.multiple, n.defaultValue, !0);
                        break;
                    default:
                        typeof r.onClick == "function" && (A.onclick = Ir)
                    }
                    switch (t) {
                    case "button":
                    case "input":
                    case "select":
                    case "textarea":
                        n = !!n.autoFocus;
                        break A;
                    case "img":
                        n = !0;
                        break A;
                    default:
                        n = !1
                    }
                }
                n && (e.flags |= 4)
            }
            e.ref !== null && (e.flags |= 512,
            e.flags |= 2097152)
        }
        return zA(e),
        null;
    case 6:
        if (A && e.stateNode != null)
            Pd(A, e, A.memoizedProps, n);
        else {
            if (typeof n != "string" && e.stateNode === null)
                throw Error(S(166));
            if (t = st(Cn.current),
            st(ve.current),
            xr(e)) {
                if (n = e.stateNode,
                t = e.memoizedProps,
                n[pe] = e,
                (l = n.nodeValue !== t) && (A = FA,
                A !== null))
                    switch (A.tag) {
                    case 3:
                        Lr(n.nodeValue, t, (A.mode & 1) !== 0);
                        break;
                    case 5:
                        A.memoizedProps.suppressHydrationWarning !== !0 && Lr(n.nodeValue, t, (A.mode & 1) !== 0)
                    }
                l && (e.flags |= 4)
            } else
                n = (t.nodeType === 9 ? t : t.ownerDocument).createTextNode(n),
                n[pe] = e,
                e.stateNode = n
        }
        return zA(e),
        null;
    case 13:
        if (AA(lA),
        n = e.memoizedState,
        A === null || A.memoizedState !== null && A.memoizedState.dehydrated !== null) {
            if (eA && EA !== null && e.mode & 1 && !(e.flags & 128))
                _s(),
                Yt(),
                e.flags |= 98560,
                l = !1;
            else if (l = xr(e),
            n !== null && n.dehydrated !== null) {
                if (A === null) {
                    if (!l)
                        throw Error(S(318));
                    if (l = e.memoizedState,
                    l = l !== null ? l.dehydrated : null,
                    !l)
                        throw Error(S(317));
                    l[pe] = e
                } else
                    Yt(),
                    !(e.flags & 128) && (e.memoizedState = null),
                    e.flags |= 4;
                zA(e),
                l = !1
            } else
                ae !== null && (na(ae),
                ae = null),
                l = !0;
            if (!l)
                return e.flags & 65536 ? e : null
        }
        return e.flags & 128 ? (e.lanes = t,
        e) : (n = n !== null,
        n !== (A !== null && A.memoizedState !== null) && n && (e.child.flags |= 8192,
        e.mode & 1 && (A === null || lA.current & 1 ? yA === 0 && (yA = 3) : Ga())),
        e.updateQueue !== null && (e.flags |= 4),
        zA(e),
        null);
    case 4:
        return Qt(),
        Yi(A, e),
        A === null && Jn(e.stateNode.containerInfo),
        zA(e),
        null;
    case 10:
        return Xa(e.type._context),
        zA(e),
        null;
    case 17:
        return ZA(e.type) && Yr(),
        zA(e),
        null;
    case 19:
        if (AA(lA),
        l = e.memoizedState,
        l === null)
            return zA(e),
            null;
        if (n = (e.flags & 128) !== 0,
        a = l.rendering,
        a === null)
            if (n)
                vn(l, !1);
            else {
                if (yA !== 0 || A !== null && A.flags & 128)
                    for (A = e.child; A !== null; ) {
                        if (a = tl(A),
                        a !== null) {
                            for (e.flags |= 128,
                            vn(l, !1),
                            n = a.updateQueue,
                            n !== null && (e.updateQueue = n,
                            e.flags |= 4),
                            e.subtreeFlags = 0,
                            n = t,
                            t = e.child; t !== null; )
                                l = t,
                                A = n,
                                l.flags &= 14680066,
                                a = l.alternate,
                                a === null ? (l.childLanes = 0,
                                l.lanes = A,
                                l.child = null,
                                l.subtreeFlags = 0,
                                l.memoizedProps = null,
                                l.memoizedState = null,
                                l.updateQueue = null,
                                l.dependencies = null,
                                l.stateNode = null) : (l.childLanes = a.childLanes,
                                l.lanes = a.lanes,
                                l.child = a.child,
                                l.subtreeFlags = 0,
                                l.deletions = null,
                                l.memoizedProps = a.memoizedProps,
                                l.memoizedState = a.memoizedState,
                                l.updateQueue = a.updateQueue,
                                l.type = a.type,
                                A = a.dependencies,
                                l.dependencies = A === null ? null : {
                                    lanes: A.lanes,
                                    firstContext: A.firstContext
                                }),
                                t = t.sibling;
                            return Q(lA, lA.current & 1 | 2),
                            e.child
                        }
                        A = A.sibling
                    }
                l.tail !== null && uA() > $t && (e.flags |= 128,
                n = !0,
                vn(l, !1),
                e.lanes = 4194304)
            }
        else {
            if (!n)
                if (A = tl(a),
                A !== null) {
                    if (e.flags |= 128,
                    n = !0,
                    t = A.updateQueue,
                    t !== null && (e.updateQueue = t,
                    e.flags |= 4),
                    vn(l, !0),
                    l.tail === null && l.tailMode === "hidden" && !a.alternate && !eA)
                        return zA(e),
                        null
                } else
                    2 * uA() - l.renderingStartTime > $t && t !== 1073741824 && (e.flags |= 128,
                    n = !0,
                    vn(l, !1),
                    e.lanes = 4194304);
            l.isBackwards ? (a.sibling = e.child,
            e.child = a) : (t = l.last,
            t !== null ? t.sibling = a : e.child = a,
            l.last = a)
        }
        return l.tail !== null ? (e = l.tail,
        l.rendering = e,
        l.tail = e.sibling,
        l.renderingStartTime = uA(),
        e.sibling = null,
        t = lA.current,
        Q(lA, n ? t & 1 | 2 : t & 1),
        e) : (zA(e),
        null);
    case 22:
    case 23:
        return Ca(),
        n = e.memoizedState !== null,
        A !== null && A.memoizedState !== null !== n && (e.flags |= 8192),
        n && e.mode & 1 ? KA & 1073741824 && (zA(e),
        e.subtreeFlags & 6 && (e.flags |= 8192)) : zA(e),
        null;
    case 24:
        return null;
    case 25:
        return null
    }
    throw Error(S(156, e.tag))
}
function qp(A, e) {
    switch (ba(e),
    e.tag) {
    case 1:
        return ZA(e.type) && Yr(),
        A = e.flags,
        A & 65536 ? (e.flags = A & -65537 | 128,
        e) : null;
    case 3:
        return Qt(),
        AA(WA),
        AA(VA),
        wa(),
        A = e.flags,
        A & 65536 && !(A & 128) ? (e.flags = A & -65537 | 128,
        e) : null;
    case 5:
        return Pa(e),
        null;
    case 13:
        if (AA(lA),
        A = e.memoizedState,
        A !== null && A.dehydrated !== null) {
            if (e.alternate === null)
                throw Error(S(340));
            Yt()
        }
        return A = e.flags,
        A & 65536 ? (e.flags = A & -65537 | 128,
        e) : null;
    case 19:
        return AA(lA),
        null;
    case 4:
        return Qt(),
        null;
    case 10:
        return Xa(e.type._context),
        null;
    case 22:
    case 23:
        return Ca(),
        null;
    case 24:
        return null;
    default:
        return null
    }
}
var Sr = !1
  , gA = !1
  , Op = typeof WeakSet == "function" ? WeakSet : Set
  , q = null;
function Rt(A, e) {
    var t = A.ref;
    if (t !== null)
        if (typeof t == "function")
            try {
                t(null)
            } catch (n) {
                oA(A, e, n)
            }
        else
            t.current = null
}
function Bi(A, e, t) {
    try {
        t()
    } catch (n) {
        oA(A, e, n)
    }
}
var bu = !1;
function kp(A, e) {
    if (ki = Fr,
    A = Rs(),
    ha(A)) {
        if ("selectionStart"in A)
            var t = {
                start: A.selectionStart,
                end: A.selectionEnd
            };
        else
            A: {
                t = (t = A.ownerDocument) && t.defaultView || window;
                var n = t.getSelection && t.getSelection();
                if (n && n.rangeCount !== 0) {
                    t = n.anchorNode;
                    var r = n.anchorOffset
                      , l = n.focusNode;
                    n = n.focusOffset;
                    try {
                        t.nodeType,
                        l.nodeType
                    } catch {
                        t = null;
                        break A
                    }
                    var a = 0
                      , u = -1
                      , s = -1
                      , y = 0
                      , N = 0
                      , L = A
                      , m = null;
                    e: for (; ; ) {
                        for (var h; L !== t || r !== 0 && L.nodeType !== 3 || (u = a + r),
                        L !== l || n !== 0 && L.nodeType !== 3 || (s = a + n),
                        L.nodeType === 3 && (a += L.nodeValue.length),
                        (h = L.firstChild) !== null; )
                            m = L,
                            L = h;
                        for (; ; ) {
                            if (L === A)
                                break e;
                            if (m === t && ++y === r && (u = a),
                            m === l && ++N === n && (s = a),
                            (h = L.nextSibling) !== null)
                                break;
                            L = m,
                            m = L.parentNode
                        }
                        L = h
                    }
                    t = u === -1 || s === -1 ? null : {
                        start: u,
                        end: s
                    }
                } else
                    t = null
            }
        t = t || {
            start: 0,
            end: 0
        }
    } else
        t = null;
    for (Pi = {
        focusedElem: A,
        selectionRange: t
    },
    Fr = !1,
    q = e; q !== null; )
        if (e = q,
        A = e.child,
        (e.subtreeFlags & 1028) !== 0 && A !== null)
            A.return = e,
            q = A;
        else
            for (; q !== null; ) {
                e = q;
                try {
                    var T = e.alternate;
                    if (e.flags & 1024)
                        switch (e.tag) {
                        case 0:
                        case 11:
                        case 15:
                            break;
                        case 1:
                            if (T !== null) {
                                var M = T.memoizedProps
                                  , J = T.memoizedState
                                  , f = e.stateNode
                                  , p = f.getSnapshotBeforeUpdate(e.elementType === e.type ? M : le(e.type, M), J);
                                f.__reactInternalSnapshotBeforeUpdate = p
                            }
                            break;
                        case 3:
                            var v = e.stateNode.containerInfo;
                            v.nodeType === 1 ? v.textContent = "" : v.nodeType === 9 && v.documentElement && v.removeChild(v.documentElement);
                            break;
                        case 5:
                        case 6:
                        case 4:
                        case 17:
                            break;
                        default:
                            throw Error(S(163))
                        }
                } catch (x) {
                    oA(e, e.return, x)
                }
                if (A = e.sibling,
                A !== null) {
                    A.return = e.return,
                    q = A;
                    break
                }
                q = e.return
            }
    return T = bu,
    bu = !1,
    T
}
function qn(A, e, t) {
    var n = e.updateQueue;
    if (n = n !== null ? n.lastEffect : null,
    n !== null) {
        var r = n = n.next;
        do {
            if ((r.tag & A) === A) {
                var l = r.destroy;
                r.destroy = void 0,
                l !== void 0 && Bi(e, t, l)
            }
            r = r.next
        } while (r !== n)
    }
}
function Tl(A, e) {
    if (e = e.updateQueue,
    e = e !== null ? e.lastEffect : null,
    e !== null) {
        var t = e = e.next;
        do {
            if ((t.tag & A) === A) {
                var n = t.create;
                t.destroy = n()
            }
            t = t.next
        } while (t !== e)
    }
}
function Qi(A) {
    var e = A.ref;
    if (e !== null) {
        var t = A.stateNode;
        switch (A.tag) {
        case 5:
            A = t;
            break;
        default:
            A = t
        }
        typeof e == "function" ? e(A) : e.current = A
    }
}
function wd(A) {
    var e = A.alternate;
    e !== null && (A.alternate = null,
    wd(e)),
    A.child = null,
    A.deletions = null,
    A.sibling = null,
    A.tag === 5 && (e = A.stateNode,
    e !== null && (delete e[pe],
    delete e[En],
    delete e[Wi],
    delete e[yp],
    delete e[vp])),
    A.stateNode = null,
    A.return = null,
    A.dependencies = null,
    A.memoizedProps = null,
    A.memoizedState = null,
    A.pendingProps = null,
    A.stateNode = null,
    A.updateQueue = null
}
function Ud(A) {
    return A.tag === 5 || A.tag === 3 || A.tag === 4
}
function zu(A) {
    A: for (; ; ) {
        for (; A.sibling === null; ) {
            if (A.return === null || Ud(A.return))
                return null;
            A = A.return
        }
        for (A.sibling.return = A.return,
        A = A.sibling; A.tag !== 5 && A.tag !== 6 && A.tag !== 18; ) {
            if (A.flags & 2 || A.child === null || A.tag === 4)
                continue A;
            A.child.return = A,
            A = A.child
        }
        if (!(A.flags & 2))
            return A.stateNode
    }
}
function _i(A, e, t) {
    var n = A.tag;
    if (n === 5 || n === 6)
        A = A.stateNode,
        e ? t.nodeType === 8 ? t.parentNode.insertBefore(A, e) : t.insertBefore(A, e) : (t.nodeType === 8 ? (e = t.parentNode,
        e.insertBefore(A, t)) : (e = t,
        e.appendChild(A)),
        t = t._reactRootContainer,
        t != null || e.onclick !== null || (e.onclick = Ir));
    else if (n !== 4 && (A = A.child,
    A !== null))
        for (_i(A, e, t),
        A = A.sibling; A !== null; )
            _i(A, e, t),
            A = A.sibling
}
function $i(A, e, t) {
    var n = A.tag;
    if (n === 5 || n === 6)
        A = A.stateNode,
        e ? t.insertBefore(A, e) : t.appendChild(A);
    else if (n !== 4 && (A = A.child,
    A !== null))
        for ($i(A, e, t),
        A = A.sibling; A !== null; )
            $i(A, e, t),
            A = A.sibling
}
var TA = null
  , ie = !1;
function Xe(A, e, t) {
    for (t = t.child; t !== null; )
        Wd(A, e, t),
        t = t.sibling
}
function Wd(A, e, t) {
    if (ye && typeof ye.onCommitFiberUnmount == "function")
        try {
            ye.onCommitFiberUnmount(yl, t)
        } catch {}
    switch (t.tag) {
    case 5:
        gA || Rt(t, e);
    case 6:
        var n = TA
          , r = ie;
        TA = null,
        Xe(A, e, t),
        TA = n,
        ie = r,
        TA !== null && (ie ? (A = TA,
        t = t.stateNode,
        A.nodeType === 8 ? A.parentNode.removeChild(t) : A.removeChild(t)) : TA.removeChild(t.stateNode));
        break;
    case 18:
        TA !== null && (ie ? (A = TA,
        t = t.stateNode,
        A.nodeType === 8 ? Ai(A.parentNode, t) : A.nodeType === 1 && Ai(A, t),
        Rn(A)) : Ai(TA, t.stateNode));
        break;
    case 4:
        n = TA,
        r = ie,
        TA = t.stateNode.containerInfo,
        ie = !0,
        Xe(A, e, t),
        TA = n,
        ie = r;
        break;
    case 0:
    case 11:
    case 14:
    case 15:
        if (!gA && (n = t.updateQueue,
        n !== null && (n = n.lastEffect,
        n !== null))) {
            r = n = n.next;
            do {
                var l = r
                  , a = l.destroy;
                l = l.tag,
                a !== void 0 && (l & 2 || l & 4) && Bi(t, e, a),
                r = r.next
            } while (r !== n)
        }
        Xe(A, e, t);
        break;
    case 1:
        if (!gA && (Rt(t, e),
        n = t.stateNode,
        typeof n.componentWillUnmount == "function"))
            try {
                n.props = t.memoizedProps,
                n.state = t.memoizedState,
                n.componentWillUnmount()
            } catch (u) {
                oA(t, e, u)
            }
        Xe(A, e, t);
        break;
    case 21:
        Xe(A, e, t);
        break;
    case 22:
        t.mode & 1 ? (gA = (n = gA) || t.memoizedState !== null,
        Xe(A, e, t),
        gA = n) : Xe(A, e, t);
        break;
    default:
        Xe(A, e, t)
    }
}
function gu(A) {
    var e = A.updateQueue;
    if (e !== null) {
        A.updateQueue = null;
        var t = A.stateNode;
        t === null && (t = A.stateNode = new Op),
        e.forEach(function(n) {
            var r = Jp.bind(null, A, n);
            t.has(n) || (t.add(n),
            n.then(r, r))
        })
    }
}
function re(A, e) {
    var t = e.deletions;
    if (t !== null)
        for (var n = 0; n < t.length; n++) {
            var r = t[n];
            try {
                var l = A
                  , a = e
                  , u = a;
                A: for (; u !== null; ) {
                    switch (u.tag) {
                    case 5:
                        TA = u.stateNode,
                        ie = !1;
                        break A;
                    case 3:
                        TA = u.stateNode.containerInfo,
                        ie = !0;
                        break A;
                    case 4:
                        TA = u.stateNode.containerInfo,
                        ie = !0;
                        break A
                    }
                    u = u.return
                }
                if (TA === null)
                    throw Error(S(160));
                Wd(l, a, r),
                TA = null,
                ie = !1;
                var s = r.alternate;
                s !== null && (s.return = null),
                r.return = null
            } catch (y) {
                oA(r, e, y)
            }
        }
    if (e.subtreeFlags & 12854)
        for (e = e.child; e !== null; )
            Zd(e, A),
            e = e.sibling
}
function Zd(A, e) {
    var t = A.alternate
      , n = A.flags;
    switch (A.tag) {
    case 0:
    case 11:
    case 14:
    case 15:
        if (re(e, A),
        ce(A),
        n & 4) {
            try {
                qn(3, A, A.return),
                Tl(3, A)
            } catch (M) {
                oA(A, A.return, M)
            }
            try {
                qn(5, A, A.return)
            } catch (M) {
                oA(A, A.return, M)
            }
        }
        break;
    case 1:
        re(e, A),
        ce(A),
        n & 512 && t !== null && Rt(t, t.return);
        break;
    case 5:
        if (re(e, A),
        ce(A),
        n & 512 && t !== null && Rt(t, t.return),
        A.flags & 32) {
            var r = A.stateNode;
            try {
                wn(r, "")
            } catch (M) {
                oA(A, A.return, M)
            }
        }
        if (n & 4 && (r = A.stateNode,
        r != null)) {
            var l = A.memoizedProps
              , a = t !== null ? t.memoizedProps : l
              , u = A.type
              , s = A.updateQueue;
            if (A.updateQueue = null,
            s !== null)
                try {
                    u === "input" && l.type === "radio" && l.name != null && is(r, l),
                    Ti(u, a);
                    var y = Ti(u, l);
                    for (a = 0; a < s.length; a += 2) {
                        var N = s[a]
                          , L = s[a + 1];
                        N === "style" ? ds(r, L) : N === "dangerouslySetInnerHTML" ? us(r, L) : N === "children" ? wn(r, L) : da(r, N, L, y)
                    }
                    switch (u) {
                    case "input":
                        Li(r, l);
                        break;
                    case "textarea":
                        as(r, l);
                        break;
                    case "select":
                        var m = r._wrapperState.wasMultiple;
                        r._wrapperState.wasMultiple = !!l.multiple;
                        var h = l.value;
                        h != null ? Ht(r, !!l.multiple, h, !1) : m !== !!l.multiple && (l.defaultValue != null ? Ht(r, !!l.multiple, l.defaultValue, !0) : Ht(r, !!l.multiple, l.multiple ? [] : "", !1))
                    }
                    r[En] = l
                } catch (M) {
                    oA(A, A.return, M)
                }
        }
        break;
    case 6:
        if (re(e, A),
        ce(A),
        n & 4) {
            if (A.stateNode === null)
                throw Error(S(162));
            r = A.stateNode,
            l = A.memoizedProps;
            try {
                r.nodeValue = l
            } catch (M) {
                oA(A, A.return, M)
            }
        }
        break;
    case 3:
        if (re(e, A),
        ce(A),
        n & 4 && t !== null && t.memoizedState.isDehydrated)
            try {
                Rn(e.containerInfo)
            } catch (M) {
                oA(A, A.return, M)
            }
        break;
    case 4:
        re(e, A),
        ce(A);
        break;
    case 13:
        re(e, A),
        ce(A),
        r = A.child,
        r.flags & 8192 && (l = r.memoizedState !== null,
        r.stateNode.isHidden = l,
        !l || r.alternate !== null && r.alternate.memoizedState !== null || (Ea = uA())),
        n & 4 && gu(A);
        break;
    case 22:
        if (N = t !== null && t.memoizedState !== null,
        A.mode & 1 ? (gA = (y = gA) || N,
        re(e, A),
        gA = y) : re(e, A),
        ce(A),
        n & 8192) {
            if (y = A.memoizedState !== null,
            (A.stateNode.isHidden = y) && !N && A.mode & 1)
                for (q = A,
                N = A.child; N !== null; ) {
                    for (L = q = N; q !== null; ) {
                        switch (m = q,
                        h = m.child,
                        m.tag) {
                        case 0:
                        case 11:
                        case 14:
                        case 15:
                            qn(4, m, m.return);
                            break;
                        case 1:
                            Rt(m, m.return);
                            var T = m.stateNode;
                            if (typeof T.componentWillUnmount == "function") {
                                n = m,
                                t = m.return;
                                try {
                                    e = n,
                                    T.props = e.memoizedProps,
                                    T.state = e.memoizedState,
                                    T.componentWillUnmount()
                                } catch (M) {
                                    oA(n, t, M)
                                }
                            }
                            break;
                        case 5:
                            Rt(m, m.return);
                            break;
                        case 22:
                            if (m.memoizedState !== null) {
                                Xu(L);
                                continue
                            }
                        }
                        h !== null ? (h.return = m,
                        q = h) : Xu(L)
                    }
                    N = N.sibling
                }
            A: for (N = null,
            L = A; ; ) {
                if (L.tag === 5) {
                    if (N === null) {
                        N = L;
                        try {
                            r = L.stateNode,
                            y ? (l = r.style,
                            typeof l.setProperty == "function" ? l.setProperty("display", "none", "important") : l.display = "none") : (u = L.stateNode,
                            s = L.memoizedProps.style,
                            a = s != null && s.hasOwnProperty("display") ? s.display : null,
                            u.style.display = ss("display", a))
                        } catch (M) {
                            oA(A, A.return, M)
                        }
                    }
                } else if (L.tag === 6) {
                    if (N === null)
                        try {
                            L.stateNode.nodeValue = y ? "" : L.memoizedProps
                        } catch (M) {
                            oA(A, A.return, M)
                        }
                } else if ((L.tag !== 22 && L.tag !== 23 || L.memoizedState === null || L === A) && L.child !== null) {
                    L.child.return = L,
                    L = L.child;
                    continue
                }
                if (L === A)
                    break A;
                for (; L.sibling === null; ) {
                    if (L.return === null || L.return === A)
                        break A;
                    N === L && (N = null),
                    L = L.return
                }
                N === L && (N = null),
                L.sibling.return = L.return,
                L = L.sibling
            }
        }
        break;
    case 19:
        re(e, A),
        ce(A),
        n & 4 && gu(A);
        break;
    case 21:
        break;
    default:
        re(e, A),
        ce(A)
    }
}
function ce(A) {
    var e = A.flags;
    if (e & 2) {
        try {
            A: {
                for (var t = A.return; t !== null; ) {
                    if (Ud(t)) {
                        var n = t;
                        break A
                    }
                    t = t.return
                }
                throw Error(S(160))
            }
            switch (n.tag) {
            case 5:
                var r = n.stateNode;
                n.flags & 32 && (wn(r, ""),
                n.flags &= -33);
                var l = zu(A);
                $i(A, l, r);
                break;
            case 3:
            case 4:
                var a = n.stateNode.containerInfo
                  , u = zu(A);
                _i(A, u, a);
                break;
            default:
                throw Error(S(161))
            }
        } catch (s) {
            oA(A, A.return, s)
        }
        A.flags &= -3
    }
    e & 4096 && (A.flags &= -4097)
}
function Pp(A, e, t) {
    q = A,
    Rd(A)
}
function Rd(A, e, t) {
    for (var n = (A.mode & 1) !== 0; q !== null; ) {
        var r = q
          , l = r.child;
        if (r.tag === 22 && n) {
            var a = r.memoizedState !== null || Sr;
            if (!a) {
                var u = r.alternate
                  , s = u !== null && u.memoizedState !== null || gA;
                u = Sr;
                var y = gA;
                if (Sr = a,
                (gA = s) && !y)
                    for (q = r; q !== null; )
                        a = q,
                        s = a.child,
                        a.tag === 22 && a.memoizedState !== null ? qu(r) : s !== null ? (s.return = a,
                        q = s) : qu(r);
                for (; l !== null; )
                    q = l,
                    Rd(l),
                    l = l.sibling;
                q = r,
                Sr = u,
                gA = y
            }
            Vu(A)
        } else
            r.subtreeFlags & 8772 && l !== null ? (l.return = r,
            q = l) : Vu(A)
    }
}
function Vu(A) {
    for (; q !== null; ) {
        var e = q;
        if (e.flags & 8772) {
            var t = e.alternate;
            try {
                if (e.flags & 8772)
                    switch (e.tag) {
                    case 0:
                    case 11:
                    case 15:
                        gA || Tl(5, e);
                        break;
                    case 1:
                        var n = e.stateNode;
                        if (e.flags & 4 && !gA)
                            if (t === null)
                                n.componentDidMount();
                            else {
                                var r = e.elementType === e.type ? t.memoizedProps : le(e.type, t.memoizedProps);
                                n.componentDidUpdate(r, t.memoizedState, n.__reactInternalSnapshotBeforeUpdate)
                            }
                        var l = e.updateQueue;
                        l !== null && fu(e, l, n);
                        break;
                    case 3:
                        var a = e.updateQueue;
                        if (a !== null) {
                            if (t = null,
                            e.child !== null)
                                switch (e.child.tag) {
                                case 5:
                                    t = e.child.stateNode;
                                    break;
                                case 1:
                                    t = e.child.stateNode
                                }
                            fu(e, a, t)
                        }
                        break;
                    case 5:
                        var u = e.stateNode;
                        if (t === null && e.flags & 4) {
                            t = u;
                            var s = e.memoizedProps;
                            switch (e.type) {
                            case "button":
                            case "input":
                            case "select":
                            case "textarea":
                                s.autoFocus && t.focus();
                                break;
                            case "img":
                                s.src && (t.src = s.src)
                            }
                        }
                        break;
                    case 6:
                        break;
                    case 4:
                        break;
                    case 12:
                        break;
                    case 13:
                        if (e.memoizedState === null) {
                            var y = e.alternate;
                            if (y !== null) {
                                var N = y.memoizedState;
                                if (N !== null) {
                                    var L = N.dehydrated;
                                    L !== null && Rn(L)
                                }
                            }
                        }
                        break;
                    case 19:
                    case 17:
                    case 21:
                    case 22:
                    case 23:
                    case 25:
                        break;
                    default:
                        throw Error(S(163))
                    }
                gA || e.flags & 512 && Qi(e)
            } catch (m) {
                oA(e, e.return, m)
            }
        }
        if (e === A) {
            q = null;
            break
        }
        if (t = e.sibling,
        t !== null) {
            t.return = e.return,
            q = t;
            break
        }
        q = e.return
    }
}
function Xu(A) {
    for (; q !== null; ) {
        var e = q;
        if (e === A) {
            q = null;
            break
        }
        var t = e.sibling;
        if (t !== null) {
            t.return = e.return,
            q = t;
            break
        }
        q = e.return
    }
}
function qu(A) {
    for (; q !== null; ) {
        var e = q;
        try {
            switch (e.tag) {
            case 0:
            case 11:
            case 15:
                var t = e.return;
                try {
                    Tl(4, e)
                } catch (s) {
                    oA(e, t, s)
                }
                break;
            case 1:
                var n = e.stateNode;
                if (typeof n.componentDidMount == "function") {
                    var r = e.return;
                    try {
                        n.componentDidMount()
                    } catch (s) {
                        oA(e, r, s)
                    }
                }
                var l = e.return;
                try {
                    Qi(e)
                } catch (s) {
                    oA(e, l, s)
                }
                break;
            case 5:
                var a = e.return;
                try {
                    Qi(e)
                } catch (s) {
                    oA(e, a, s)
                }
            }
        } catch (s) {
            oA(e, e.return, s)
        }
        if (e === A) {
            q = null;
            break
        }
        var u = e.sibling;
        if (u !== null) {
            u.return = e.return,
            q = u;
            break
        }
        q = e.return
    }
}
var wp = Math.ceil
  , ll = ge.ReactCurrentDispatcher
  , Ja = ge.ReactCurrentOwner
  , ee = ge.ReactCurrentBatchConfig
  , C = 0
  , LA = null
  , dA = null
  , hA = 0
  , KA = 0
  , Dt = Ye(0)
  , yA = 0
  , Bn = null
  , vt = 0
  , hl = 0
  , Ka = 0
  , On = null
  , wA = null
  , Ea = 0
  , $t = 1 / 0
  , xe = null
  , il = !1
  , Aa = null
  , Ke = null
  , Tr = !1
  , We = null
  , al = 0
  , kn = 0
  , ea = null
  , Ur = -1
  , Wr = 0;
function qA() {
    return C & 6 ? uA() : Ur !== -1 ? Ur : Ur = uA()
}
function Ee(A) {
    return A.mode & 1 ? C & 2 && hA !== 0 ? hA & -hA : Lp.transition !== null ? (Wr === 0 && (Wr = Ts()),
    Wr) : (A = I,
    A !== 0 || (A = window.event,
    A = A === void 0 ? 16 : Xs(A.type)),
    A) : 1
}
function ue(A, e, t, n) {
    if (50 < kn)
        throw kn = 0,
        ea = null,
        Error(S(185));
    $n(A, t, n),
    (!(C & 2) || A !== LA) && (A === LA && (!(C & 2) && (hl |= t),
    yA === 4 && we(A, hA)),
    RA(A, n),
    t === 1 && C === 0 && !(e.mode & 1) && ($t = uA() + 500,
    jl && Be()))
}
function RA(A, e) {
    var t = A.callbackNode;
    Lf(A, e);
    var n = Er(A, A === LA ? hA : 0);
    if (n === 0)
        t !== null && Do(t),
        A.callbackNode = null,
        A.callbackPriority = 0;
    else if (e = n & -n,
    A.callbackPriority !== e) {
        if (t != null && Do(t),
        e === 1)
            A.tag === 0 ? mp(Ou.bind(null, A)) : Ys(Ou.bind(null, A)),
            fp(function() {
                !(C & 6) && Be()
            }),
            t = null;
        else {
            switch (hs(n)) {
            case 1:
                t = va;
                break;
            case 4:
                t = Ns;
                break;
            case 16:
                t = Kr;
                break;
            case 536870912:
                t = Ss;
                break;
            default:
                t = Kr
            }
            t = Gd(t, Dd.bind(null, A))
        }
        A.callbackPriority = e,
        A.callbackNode = t
    }
}
function Dd(A, e) {
    if (Ur = -1,
    Wr = 0,
    C & 6)
        throw Error(S(327));
    var t = A.callbackNode;
    if (Ct() && A.callbackNode !== t)
        return null;
    var n = Er(A, A === LA ? hA : 0);
    if (n === 0)
        return null;
    if (n & 30 || n & A.expiredLanes || e)
        e = ol(A, n);
    else {
        e = n;
        var r = C;
        C |= 2;
        var l = Jd();
        (LA !== A || hA !== e) && (xe = null,
        $t = uA() + 500,
        dt(A, e));
        do
            try {
                Zp();
                break
            } catch (u) {
                Hd(A, u)
            }
        while (!0);
        Va(),
        ll.current = l,
        C = r,
        dA !== null ? e = 0 : (LA = null,
        hA = 0,
        e = yA)
    }
    if (e !== 0) {
        if (e === 2 && (r = gi(A),
        r !== 0 && (n = r,
        e = ta(A, r))),
        e === 1)
            throw t = Bn,
            dt(A, 0),
            we(A, n),
            RA(A, uA()),
            t;
        if (e === 6)
            we(A, n);
        else {
            if (r = A.current.alternate,
            !(n & 30) && !Up(r) && (e = ol(A, n),
            e === 2 && (l = gi(A),
            l !== 0 && (n = l,
            e = ta(A, l))),
            e === 1))
                throw t = Bn,
                dt(A, 0),
                we(A, n),
                RA(A, uA()),
                t;
            switch (A.finishedWork = r,
            A.finishedLanes = n,
            e) {
            case 0:
            case 1:
                throw Error(S(345));
            case 2:
                at(A, wA, xe);
                break;
            case 3:
                if (we(A, n),
                (n & 130023424) === n && (e = Ea + 500 - uA(),
                10 < e)) {
                    if (Er(A, 0) !== 0)
                        break;
                    if (r = A.suspendedLanes,
                    (r & n) !== n) {
                        qA(),
                        A.pingedLanes |= A.suspendedLanes & r;
                        break
                    }
                    A.timeoutHandle = Ui(at.bind(null, A, wA, xe), e);
                    break
                }
                at(A, wA, xe);
                break;
            case 4:
                if (we(A, n),
                (n & 4194240) === n)
                    break;
                for (e = A.eventTimes,
                r = -1; 0 < n; ) {
                    var a = 31 - oe(n);
                    l = 1 << a,
                    a = e[a],
                    a > r && (r = a),
                    n &= ~l
                }
                if (n = r,
                n = uA() - n,
                n = (120 > n ? 120 : 480 > n ? 480 : 1080 > n ? 1080 : 1920 > n ? 1920 : 3e3 > n ? 3e3 : 4320 > n ? 4320 : 1960 * wp(n / 1960)) - n,
                10 < n) {
                    A.timeoutHandle = Ui(at.bind(null, A, wA, xe), n);
                    break
                }
                at(A, wA, xe);
                break;
            case 5:
                at(A, wA, xe);
                break;
            default:
                throw Error(S(329))
            }
        }
    }
    return RA(A, uA()),
    A.callbackNode === t ? Dd.bind(null, A) : null
}
function ta(A, e) {
    var t = On;
    return A.current.memoizedState.isDehydrated && (dt(A, e).flags |= 256),
    A = ol(A, e),
    A !== 2 && (e = wA,
    wA = t,
    e !== null && na(e)),
    A
}
function na(A) {
    wA === null ? wA = A : wA.push.apply(wA, A)
}
function Up(A) {
    for (var e = A; ; ) {
        if (e.flags & 16384) {
            var t = e.updateQueue;
            if (t !== null && (t = t.stores,
            t !== null))
                for (var n = 0; n < t.length; n++) {
                    var r = t[n]
                      , l = r.getSnapshot;
                    r = r.value;
                    try {
                        if (!se(l(), r))
                            return !1
                    } catch {
                        return !1
                    }
                }
        }
        if (t = e.child,
        e.subtreeFlags & 16384 && t !== null)
            t.return = e,
            e = t;
        else {
            if (e === A)
                break;
            for (; e.sibling === null; ) {
                if (e.return === null || e.return === A)
                    return !0;
                e = e.return
            }
            e.sibling.return = e.return,
            e = e.sibling
        }
    }
    return !0
}
function we(A, e) {
    for (e &= ~Ka,
    e &= ~hl,
    A.suspendedLanes |= e,
    A.pingedLanes &= ~e,
    A = A.expirationTimes; 0 < e; ) {
        var t = 31 - oe(e)
          , n = 1 << t;
        A[t] = -1,
        e &= ~n
    }
}
function Ou(A) {
    if (C & 6)
        throw Error(S(327));
    Ct();
    var e = Er(A, 0);
    if (!(e & 1))
        return RA(A, uA()),
        null;
    var t = ol(A, e);
    if (A.tag !== 0 && t === 2) {
        var n = gi(A);
        n !== 0 && (e = n,
        t = ta(A, n))
    }
    if (t === 1)
        throw t = Bn,
        dt(A, 0),
        we(A, e),
        RA(A, uA()),
        t;
    if (t === 6)
        throw Error(S(345));
    return A.finishedWork = A.current.alternate,
    A.finishedLanes = e,
    at(A, wA, xe),
    RA(A, uA()),
    null
}
function Fa(A, e) {
    var t = C;
    C |= 1;
    try {
        return A(e)
    } finally {
        C = t,
        C === 0 && ($t = uA() + 500,
        jl && Be())
    }
}
function mt(A) {
    We !== null && We.tag === 0 && !(C & 6) && Ct();
    var e = C;
    C |= 1;
    var t = ee.transition
      , n = I;
    try {
        if (ee.transition = null,
        I = 1,
        A)
            return A()
    } finally {
        I = n,
        ee.transition = t,
        C = e,
        !(C & 6) && Be()
    }
}
function Ca() {
    KA = Dt.current,
    AA(Dt)
}
function dt(A, e) {
    A.finishedWork = null,
    A.finishedLanes = 0;
    var t = A.timeoutHandle;
    if (t !== -1 && (A.timeoutHandle = -1,
    cp(t)),
    dA !== null)
        for (t = dA.return; t !== null; ) {
            var n = t;
            switch (ba(n),
            n.tag) {
            case 1:
                n = n.type.childContextTypes,
                n != null && Yr();
                break;
            case 3:
                Qt(),
                AA(WA),
                AA(VA),
                wa();
                break;
            case 5:
                Pa(n);
                break;
            case 4:
                Qt();
                break;
            case 13:
                AA(lA);
                break;
            case 19:
                AA(lA);
                break;
            case 10:
                Xa(n.type._context);
                break;
            case 22:
            case 23:
                Ca()
            }
            t = t.return
        }
    if (LA = A,
    dA = A = Fe(A.current, null),
    hA = KA = e,
    yA = 0,
    Bn = null,
    Ka = hl = vt = 0,
    wA = On = null,
    ut !== null) {
        for (e = 0; e < ut.length; e++)
            if (t = ut[e],
            n = t.interleaved,
            n !== null) {
                t.interleaved = null;
                var r = n.next
                  , l = t.pending;
                if (l !== null) {
                    var a = l.next;
                    l.next = r,
                    n.next = a
                }
                t.pending = n
            }
        ut = null
    }
    return A
}
function Hd(A, e) {
    do {
        var t = dA;
        try {
            if (Va(),
            kr.current = rl,
            nl) {
                for (var n = iA.memoizedState; n !== null; ) {
                    var r = n.queue;
                    r !== null && (r.pending = null),
                    n = n.next
                }
                nl = !1
            }
            if (yt = 0,
            mA = pA = iA = null,
            Xn = !1,
            Gn = 0,
            Ja.current = null,
            t === null || t.return === null) {
                yA = 1,
                Bn = e,
                dA = null;
                break
            }
            A: {
                var l = A
                  , a = t.return
                  , u = t
                  , s = e;
                if (e = hA,
                u.flags |= 32768,
                s !== null && typeof s == "object" && typeof s.then == "function") {
                    var y = s
                      , N = u
                      , L = N.tag;
                    if (!(N.mode & 1) && (L === 0 || L === 11 || L === 15)) {
                        var m = N.alternate;
                        m ? (N.updateQueue = m.updateQueue,
                        N.memoizedState = m.memoizedState,
                        N.lanes = m.lanes) : (N.updateQueue = null,
                        N.memoizedState = null)
                    }
                    var h = xu(a);
                    if (h !== null) {
                        h.flags &= -257,
                        ju(h, a, u, l, e),
                        h.mode & 1 && Lu(l, y, e),
                        e = h,
                        s = y;
                        var T = e.updateQueue;
                        if (T === null) {
                            var M = new Set;
                            M.add(s),
                            e.updateQueue = M
                        } else
                            T.add(s);
                        break A
                    } else {
                        if (!(e & 1)) {
                            Lu(l, y, e),
                            Ga();
                            break A
                        }
                        s = Error(S(426))
                    }
                } else if (eA && u.mode & 1) {
                    var J = xu(a);
                    if (J !== null) {
                        !(J.flags & 65536) && (J.flags |= 256),
                        ju(J, a, u, l, e),
                        za(_t(s, u));
                        break A
                    }
                }
                l = s = _t(s, u),
                yA !== 4 && (yA = 2),
                On === null ? On = [l] : On.push(l),
                l = a;
                do {
                    switch (l.tag) {
                    case 3:
                        l.flags |= 65536,
                        e &= -e,
                        l.lanes |= e;
                        var f = hd(l, s, e);
                        cu(l, f);
                        break A;
                    case 1:
                        u = s;
                        var p = l.type
                          , v = l.stateNode;
                        if (!(l.flags & 128) && (typeof p.getDerivedStateFromError == "function" || v !== null && typeof v.componentDidCatch == "function" && (Ke === null || !Ke.has(v)))) {
                            l.flags |= 65536,
                            e &= -e,
                            l.lanes |= e;
                            var x = Md(l, u, e);
                            cu(l, x);
                            break A
                        }
                    }
                    l = l.return
                } while (l !== null)
            }
            Ed(t)
        } catch (b) {
            e = b,
            dA === t && t !== null && (dA = t = t.return);
            continue
        }
        break
    } while (!0)
}
function Jd() {
    var A = ll.current;
    return ll.current = rl,
    A === null ? rl : A
}
function Ga() {
    (yA === 0 || yA === 3 || yA === 2) && (yA = 4),
    LA === null || !(vt & 268435455) && !(hl & 268435455) || we(LA, hA)
}
function ol(A, e) {
    var t = C;
    C |= 2;
    var n = Jd();
    (LA !== A || hA !== e) && (xe = null,
    dt(A, e));
    do
        try {
            Wp();
            break
        } catch (r) {
            Hd(A, r)
        }
    while (!0);
    if (Va(),
    C = t,
    ll.current = n,
    dA !== null)
        throw Error(S(261));
    return LA = null,
    hA = 0,
    yA
}
function Wp() {
    for (; dA !== null; )
        Kd(dA)
}
function Zp() {
    for (; dA !== null && !uf(); )
        Kd(dA)
}
function Kd(A) {
    var e = Cd(A.alternate, A, KA);
    A.memoizedProps = A.pendingProps,
    e === null ? Ed(A) : dA = e,
    Ja.current = null
}
function Ed(A) {
    var e = A;
    do {
        var t = e.alternate;
        if (A = e.return,
        e.flags & 32768) {
            if (t = qp(t, e),
            t !== null) {
                t.flags &= 32767,
                dA = t;
                return
            }
            if (A !== null)
                A.flags |= 32768,
                A.subtreeFlags = 0,
                A.deletions = null;
            else {
                yA = 6,
                dA = null;
                return
            }
        } else if (t = Xp(t, e, KA),
        t !== null) {
            dA = t;
            return
        }
        if (e = e.sibling,
        e !== null) {
            dA = e;
            return
        }
        dA = e = A
    } while (e !== null);
    yA === 0 && (yA = 5)
}
function at(A, e, t) {
    var n = I
      , r = ee.transition;
    try {
        ee.transition = null,
        I = 1,
        Rp(A, e, t, n)
    } finally {
        ee.transition = r,
        I = n
    }
    return null
}
function Rp(A, e, t, n) {
    do
        Ct();
    while (We !== null);
    if (C & 6)
        throw Error(S(327));
    t = A.finishedWork;
    var r = A.finishedLanes;
    if (t === null)
        return null;
    if (A.finishedWork = null,
    A.finishedLanes = 0,
    t === A.current)
        throw Error(S(177));
    A.callbackNode = null,
    A.callbackPriority = 0;
    var l = t.lanes | t.childLanes;
    if (xf(A, l),
    A === LA && (dA = LA = null,
    hA = 0),
    !(t.subtreeFlags & 2064) && !(t.flags & 2064) || Tr || (Tr = !0,
    Gd(Kr, function() {
        return Ct(),
        null
    })),
    l = (t.flags & 15990) !== 0,
    t.subtreeFlags & 15990 || l) {
        l = ee.transition,
        ee.transition = null;
        var a = I;
        I = 1;
        var u = C;
        C |= 4,
        Ja.current = null,
        kp(A, t),
        Zd(t, A),
        lp(Pi),
        Fr = !!ki,
        Pi = ki = null,
        A.current = t,
        Pp(t),
        sf(),
        C = u,
        I = a,
        ee.transition = l
    } else
        A.current = t;
    if (Tr && (Tr = !1,
    We = A,
    al = r),
    l = A.pendingLanes,
    l === 0 && (Ke = null),
    ff(t.stateNode),
    RA(A, uA()),
    e !== null)
        for (n = A.onRecoverableError,
        t = 0; t < e.length; t++)
            r = e[t],
            n(r.value, {
                componentStack: r.stack,
                digest: r.digest
            });
    if (il)
        throw il = !1,
        A = Aa,
        Aa = null,
        A;
    return al & 1 && A.tag !== 0 && Ct(),
    l = A.pendingLanes,
    l & 1 ? A === ea ? kn++ : (kn = 0,
    ea = A) : kn = 0,
    Be(),
    null
}
function Ct() {
    if (We !== null) {
        var A = hs(al)
          , e = ee.transition
          , t = I;
        try {
            if (ee.transition = null,
            I = 16 > A ? 16 : A,
            We === null)
                var n = !1;
            else {
                if (A = We,
                We = null,
                al = 0,
                C & 6)
                    throw Error(S(331));
                var r = C;
                for (C |= 4,
                q = A.current; q !== null; ) {
                    var l = q
                      , a = l.child;
                    if (q.flags & 16) {
                        var u = l.deletions;
                        if (u !== null) {
                            for (var s = 0; s < u.length; s++) {
                                var y = u[s];
                                for (q = y; q !== null; ) {
                                    var N = q;
                                    switch (N.tag) {
                                    case 0:
                                    case 11:
                                    case 15:
                                        qn(8, N, l)
                                    }
                                    var L = N.child;
                                    if (L !== null)
                                        L.return = N,
                                        q = L;
                                    else
                                        for (; q !== null; ) {
                                            N = q;
                                            var m = N.sibling
                                              , h = N.return;
                                            if (wd(N),
                                            N === y) {
                                                q = null;
                                                break
                                            }
                                            if (m !== null) {
                                                m.return = h,
                                                q = m;
                                                break
                                            }
                                            q = h
                                        }
                                }
                            }
                            var T = l.alternate;
                            if (T !== null) {
                                var M = T.child;
                                if (M !== null) {
                                    T.child = null;
                                    do {
                                        var J = M.sibling;
                                        M.sibling = null,
                                        M = J
                                    } while (M !== null)
                                }
                            }
                            q = l
                        }
                    }
                    if (l.subtreeFlags & 2064 && a !== null)
                        a.return = l,
                        q = a;
                    else
                        A: for (; q !== null; ) {
                            if (l = q,
                            l.flags & 2048)
                                switch (l.tag) {
                                case 0:
                                case 11:
                                case 15:
                                    qn(9, l, l.return)
                                }
                            var f = l.sibling;
                            if (f !== null) {
                                f.return = l.return,
                                q = f;
                                break A
                            }
                            q = l.return
                        }
                }
                var p = A.current;
                for (q = p; q !== null; ) {
                    a = q;
                    var v = a.child;
                    if (a.subtreeFlags & 2064 && v !== null)
                        v.return = a,
                        q = v;
                    else
                        A: for (a = p; q !== null; ) {
                            if (u = q,
                            u.flags & 2048)
                                try {
                                    switch (u.tag) {
                                    case 0:
                                    case 11:
                                    case 15:
                                        Tl(9, u)
                                    }
                                } catch (b) {
                                    oA(u, u.return, b)
                                }
                            if (u === a) {
                                q = null;
                                break A
                            }
                            var x = u.sibling;
                            if (x !== null) {
                                x.return = u.return,
                                q = x;
                                break A
                            }
                            q = u.return
                        }
                }
                if (C = r,
                Be(),
                ye && typeof ye.onPostCommitFiberRoot == "function")
                    try {
                        ye.onPostCommitFiberRoot(yl, A)
                    } catch {}
                n = !0
            }
            return n
        } finally {
            I = t,
            ee.transition = e
        }
    }
    return !1
}
function ku(A, e, t) {
    e = _t(t, e),
    e = hd(A, e, 1),
    A = Je(A, e, 1),
    e = qA(),
    A !== null && ($n(A, 1, e),
    RA(A, e))
}
function oA(A, e, t) {
    if (A.tag === 3)
        ku(A, A, t);
    else
        for (; e !== null; ) {
            if (e.tag === 3) {
                ku(e, A, t);
                break
            } else if (e.tag === 1) {
                var n = e.stateNode;
                if (typeof e.type.getDerivedStateFromError == "function" || typeof n.componentDidCatch == "function" && (Ke === null || !Ke.has(n))) {
                    A = _t(t, A),
                    A = Md(e, A, 1),
                    e = Je(e, A, 1),
                    A = qA(),
                    e !== null && ($n(e, 1, A),
                    RA(e, A));
                    break
                }
            }
            e = e.return
        }
}
function Dp(A, e, t) {
    var n = A.pingCache;
    n !== null && n.delete(e),
    e = qA(),
    A.pingedLanes |= A.suspendedLanes & t,
    LA === A && (hA & t) === t && (yA === 4 || yA === 3 && (hA & 130023424) === hA && 500 > uA() - Ea ? dt(A, 0) : Ka |= t),
    RA(A, e)
}
function Fd(A, e) {
    e === 0 && (A.mode & 1 ? (e = fr,
    fr <<= 1,
    !(fr & 130023424) && (fr = 4194304)) : e = 1);
    var t = qA();
    A = be(A, e),
    A !== null && ($n(A, e, t),
    RA(A, t))
}
function Hp(A) {
    var e = A.memoizedState
      , t = 0;
    e !== null && (t = e.retryLane),
    Fd(A, t)
}
function Jp(A, e) {
    var t = 0;
    switch (A.tag) {
    case 13:
        var n = A.stateNode
          , r = A.memoizedState;
        r !== null && (t = r.retryLane);
        break;
    case 19:
        n = A.stateNode;
        break;
    default:
        throw Error(S(314))
    }
    n !== null && n.delete(e),
    Fd(A, t)
}
var Cd;
Cd = function(A, e, t) {
    if (A !== null)
        if (A.memoizedProps !== e.pendingProps || WA.current)
            UA = !0;
        else {
            if (!(A.lanes & t) && !(e.flags & 128))
                return UA = !1,
                Vp(A, e, t);
            UA = !!(A.flags & 131072)
        }
    else
        UA = !1,
        eA && e.flags & 1048576 && Bs(e, _r, e.index);
    switch (e.lanes = 0,
    e.tag) {
    case 2:
        var n = e.type;
        wr(A, e),
        A = e.pendingProps;
        var r = It(e, VA.current);
        Ft(e, t),
        r = Wa(null, e, n, A, r, t);
        var l = Za();
        return e.flags |= 1,
        typeof r == "object" && r !== null && typeof r.render == "function" && r.$$typeof === void 0 ? (e.tag = 1,
        e.memoizedState = null,
        e.updateQueue = null,
        ZA(n) ? (l = !0,
        Br(e)) : l = !1,
        e.memoizedState = r.state !== null && r.state !== void 0 ? r.state : null,
        Oa(e),
        r.updater = Sl,
        e.stateNode = r,
        r._reactInternals = e,
        Ki(e, n, A, t),
        e = Ci(null, e, n, !0, l, t)) : (e.tag = 0,
        eA && l && Ma(e),
        XA(null, e, r, t),
        e = e.child),
        e;
    case 16:
        n = e.elementType;
        A: {
            switch (wr(A, e),
            A = e.pendingProps,
            r = n._init,
            n = r(n._payload),
            e.type = n,
            r = e.tag = Ep(n),
            A = le(n, A),
            r) {
            case 0:
                e = Fi(null, e, n, A, t);
                break A;
            case 1:
                e = Tu(null, e, n, A, t);
                break A;
            case 11:
                e = Nu(null, e, n, A, t);
                break A;
            case 14:
                e = Su(null, e, n, le(n.type, A), t);
                break A
            }
            throw Error(S(306, n, ""))
        }
        return e;
    case 0:
        return n = e.type,
        r = e.pendingProps,
        r = e.elementType === n ? r : le(n, r),
        Fi(A, e, n, r, t);
    case 1:
        return n = e.type,
        r = e.pendingProps,
        r = e.elementType === n ? r : le(n, r),
        Tu(A, e, n, r, t);
    case 3:
        A: {
            if (Vd(e),
            A === null)
                throw Error(S(387));
            n = e.pendingProps,
            l = e.memoizedState,
            r = l.element,
            td(A, e),
            el(e, n, null, t);
            var a = e.memoizedState;
            if (n = a.element,
            l.isDehydrated)
                if (l = {
                    element: n,
                    isDehydrated: !1,
                    cache: a.cache,
                    pendingSuspenseBoundaries: a.pendingSuspenseBoundaries,
                    transitions: a.transitions
                },
                e.updateQueue.baseState = l,
                e.memoizedState = l,
                e.flags & 256) {
                    r = _t(Error(S(423)), e),
                    e = hu(A, e, n, t, r);
                    break A
                } else if (n !== r) {
                    r = _t(Error(S(424)), e),
                    e = hu(A, e, n, t, r);
                    break A
                } else
                    for (EA = He(e.stateNode.containerInfo.firstChild),
                    FA = e,
                    eA = !0,
                    ae = null,
                    t = Ad(e, null, n, t),
                    e.child = t; t; )
                        t.flags = t.flags & -3 | 4096,
                        t = t.sibling;
            else {
                if (Yt(),
                n === r) {
                    e = ze(A, e, t);
                    break A
                }
                XA(A, e, n, t)
            }
            e = e.child
        }
        return e;
    case 5:
        return nd(e),
        A === null && Di(e),
        n = e.type,
        r = e.pendingProps,
        l = A !== null ? A.memoizedProps : null,
        a = r.children,
        wi(n, r) ? a = null : l !== null && wi(n, l) && (e.flags |= 32),
        gd(A, e),
        XA(A, e, a, t),
        e.child;
    case 6:
        return A === null && Di(e),
        null;
    case 13:
        return Xd(A, e, t);
    case 4:
        return ka(e, e.stateNode.containerInfo),
        n = e.pendingProps,
        A === null ? e.child = Bt(e, null, n, t) : XA(A, e, n, t),
        e.child;
    case 11:
        return n = e.type,
        r = e.pendingProps,
        r = e.elementType === n ? r : le(n, r),
        Nu(A, e, n, r, t);
    case 7:
        return XA(A, e, e.pendingProps, t),
        e.child;
    case 8:
        return XA(A, e, e.pendingProps.children, t),
        e.child;
    case 12:
        return XA(A, e, e.pendingProps.children, t),
        e.child;
    case 10:
        A: {
            if (n = e.type._context,
            r = e.pendingProps,
            l = e.memoizedProps,
            a = r.value,
            Q($r, n._currentValue),
            n._currentValue = a,
            l !== null)
                if (se(l.value, a)) {
                    if (l.children === r.children && !WA.current) {
                        e = ze(A, e, t);
                        break A
                    }
                } else
                    for (l = e.child,
                    l !== null && (l.return = e); l !== null; ) {
                        var u = l.dependencies;
                        if (u !== null) {
                            a = l.child;
                            for (var s = u.firstContext; s !== null; ) {
                                if (s.context === n) {
                                    if (l.tag === 1) {
                                        s = Te(-1, t & -t),
                                        s.tag = 2;
                                        var y = l.updateQueue;
                                        if (y !== null) {
                                            y = y.shared;
                                            var N = y.pending;
                                            N === null ? s.next = s : (s.next = N.next,
                                            N.next = s),
                                            y.pending = s
                                        }
                                    }
                                    l.lanes |= t,
                                    s = l.alternate,
                                    s !== null && (s.lanes |= t),
                                    Hi(l.return, t, e),
                                    u.lanes |= t;
                                    break
                                }
                                s = s.next
                            }
                        } else if (l.tag === 10)
                            a = l.type === e.type ? null : l.child;
                        else if (l.tag === 18) {
                            if (a = l.return,
                            a === null)
                                throw Error(S(341));
                            a.lanes |= t,
                            u = a.alternate,
                            u !== null && (u.lanes |= t),
                            Hi(a, t, e),
                            a = l.sibling
                        } else
                            a = l.child;
                        if (a !== null)
                            a.return = l;
                        else
                            for (a = l; a !== null; ) {
                                if (a === e) {
                                    a = null;
                                    break
                                }
                                if (l = a.sibling,
                                l !== null) {
                                    l.return = a.return,
                                    a = l;
                                    break
                                }
                                a = a.return
                            }
                        l = a
                    }
            XA(A, e, r.children, t),
            e = e.child
        }
        return e;
    case 9:
        return r = e.type,
        n = e.pendingProps.children,
        Ft(e, t),
        r = te(r),
        n = n(r),
        e.flags |= 1,
        XA(A, e, n, t),
        e.child;
    case 14:
        return n = e.type,
        r = le(n, e.pendingProps),
        r = le(n.type, r),
        Su(A, e, n, r, t);
    case 15:
        return bd(A, e, e.type, e.pendingProps, t);
    case 17:
        return n = e.type,
        r = e.pendingProps,
        r = e.elementType === n ? r : le(n, r),
        wr(A, e),
        e.tag = 1,
        ZA(n) ? (A = !0,
        Br(e)) : A = !1,
        Ft(e, t),
        Td(e, n, r),
        Ki(e, n, r, t),
        Ci(null, e, n, !0, A, t);
    case 19:
        return qd(A, e, t);
    case 22:
        return zd(A, e, t)
    }
    throw Error(S(156, e.tag))
}
;
function Gd(A, e) {
    return js(A, e)
}
function Kp(A, e, t, n) {
    this.tag = A,
    this.key = t,
    this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null,
    this.index = 0,
    this.ref = null,
    this.pendingProps = e,
    this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null,
    this.mode = n,
    this.subtreeFlags = this.flags = 0,
    this.deletions = null,
    this.childLanes = this.lanes = 0,
    this.alternate = null
}
function Ae(A, e, t, n) {
    return new Kp(A,e,t,n)
}
function Ia(A) {
    return A = A.prototype,
    !(!A || !A.isReactComponent)
}
function Ep(A) {
    if (typeof A == "function")
        return Ia(A) ? 1 : 0;
    if (A != null) {
        if (A = A.$$typeof,
        A === fa)
            return 11;
        if (A === pa)
            return 14
    }
    return 2
}
function Fe(A, e) {
    var t = A.alternate;
    return t === null ? (t = Ae(A.tag, e, A.key, A.mode),
    t.elementType = A.elementType,
    t.type = A.type,
    t.stateNode = A.stateNode,
    t.alternate = A,
    A.alternate = t) : (t.pendingProps = e,
    t.type = A.type,
    t.flags = 0,
    t.subtreeFlags = 0,
    t.deletions = null),
    t.flags = A.flags & 14680064,
    t.childLanes = A.childLanes,
    t.lanes = A.lanes,
    t.child = A.child,
    t.memoizedProps = A.memoizedProps,
    t.memoizedState = A.memoizedState,
    t.updateQueue = A.updateQueue,
    e = A.dependencies,
    t.dependencies = e === null ? null : {
        lanes: e.lanes,
        firstContext: e.firstContext
    },
    t.sibling = A.sibling,
    t.index = A.index,
    t.ref = A.ref,
    t
}
function Zr(A, e, t, n, r, l) {
    var a = 2;
    if (n = A,
    typeof A == "function")
        Ia(A) && (a = 1);
    else if (typeof A == "string")
        a = 5;
    else
        A: switch (A) {
        case Xt:
            return ct(t.children, r, l, e);
        case ca:
            a = 8,
            r |= 8;
            break;
        case fi:
            return A = Ae(12, t, e, r | 2),
            A.elementType = fi,
            A.lanes = l,
            A;
        case pi:
            return A = Ae(13, t, e, r),
            A.elementType = pi,
            A.lanes = l,
            A;
        case yi:
            return A = Ae(19, t, e, r),
            A.elementType = yi,
            A.lanes = l,
            A;
        case ns:
            return Ml(t, r, l, e);
        default:
            if (typeof A == "object" && A !== null)
                switch (A.$$typeof) {
                case es:
                    a = 10;
                    break A;
                case ts:
                    a = 9;
                    break A;
                case fa:
                    a = 11;
                    break A;
                case pa:
                    a = 14;
                    break A;
                case Oe:
                    a = 16,
                    n = null;
                    break A
                }
            throw Error(S(130, A == null ? A : typeof A, ""))
        }
    return e = Ae(a, t, e, r),
    e.elementType = A,
    e.type = n,
    e.lanes = l,
    e
}
function ct(A, e, t, n) {
    return A = Ae(7, A, n, e),
    A.lanes = t,
    A
}
function Ml(A, e, t, n) {
    return A = Ae(22, A, n, e),
    A.elementType = ns,
    A.lanes = t,
    A.stateNode = {
        isHidden: !1
    },
    A
}
function oi(A, e, t) {
    return A = Ae(6, A, null, e),
    A.lanes = t,
    A
}
function ui(A, e, t) {
    return e = Ae(4, A.children !== null ? A.children : [], A.key, e),
    e.lanes = t,
    e.stateNode = {
        containerInfo: A.containerInfo,
        pendingChildren: null,
        implementation: A.implementation
    },
    e
}
function Fp(A, e, t, n, r) {
    this.tag = e,
    this.containerInfo = A,
    this.finishedWork = this.pingCache = this.current = this.pendingChildren = null,
    this.timeoutHandle = -1,
    this.callbackNode = this.pendingContext = this.context = null,
    this.callbackPriority = 0,
    this.eventTimes = Kl(0),
    this.expirationTimes = Kl(-1),
    this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0,
    this.entanglements = Kl(0),
    this.identifierPrefix = n,
    this.onRecoverableError = r,
    this.mutableSourceEagerHydrationData = null
}
function Ya(A, e, t, n, r, l, a, u, s) {
    return A = new Fp(A,e,t,u,s),
    e === 1 ? (e = 1,
    l === !0 && (e |= 8)) : e = 0,
    l = Ae(3, null, null, e),
    A.current = l,
    l.stateNode = A,
    l.memoizedState = {
        element: n,
        isDehydrated: t,
        cache: null,
        transitions: null,
        pendingSuspenseBoundaries: null
    },
    Oa(l),
    A
}
function Cp(A, e, t) {
    var n = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return {
        $$typeof: Vt,
        key: n == null ? null : "" + n,
        children: A,
        containerInfo: e,
        implementation: t
    }
}
function Id(A) {
    if (!A)
        return Ge;
    A = A._reactInternals;
    A: {
        if (xt(A) !== A || A.tag !== 1)
            throw Error(S(170));
        var e = A;
        do {
            switch (e.tag) {
            case 3:
                e = e.stateNode.context;
                break A;
            case 1:
                if (ZA(e.type)) {
                    e = e.stateNode.__reactInternalMemoizedMergedChildContext;
                    break A
                }
            }
            e = e.return
        } while (e !== null);
        throw Error(S(171))
    }
    if (A.tag === 1) {
        var t = A.type;
        if (ZA(t))
            return Is(A, t, e)
    }
    return e
}
function Yd(A, e, t, n, r, l, a, u, s) {
    return A = Ya(t, n, !0, A, r, l, a, u, s),
    A.context = Id(null),
    t = A.current,
    n = qA(),
    r = Ee(t),
    l = Te(n, r),
    l.callback = e ?? null,
    Je(t, l, r),
    A.current.lanes = r,
    $n(A, r, n),
    RA(A, n),
    A
}
function bl(A, e, t, n) {
    var r = e.current
      , l = qA()
      , a = Ee(r);
    return t = Id(t),
    e.context === null ? e.context = t : e.pendingContext = t,
    e = Te(l, a),
    e.payload = {
        element: A
    },
    n = n === void 0 ? null : n,
    n !== null && (e.callback = n),
    A = Je(r, e, a),
    A !== null && (ue(A, r, a, l),
    Or(A, r, a)),
    a
}
function ul(A) {
    if (A = A.current,
    !A.child)
        return null;
    switch (A.child.tag) {
    case 5:
        return A.child.stateNode;
    default:
        return A.child.stateNode
    }
}
function Pu(A, e) {
    if (A = A.memoizedState,
    A !== null && A.dehydrated !== null) {
        var t = A.retryLane;
        A.retryLane = t !== 0 && t < e ? t : e
    }
}
function Ba(A, e) {
    Pu(A, e),
    (A = A.alternate) && Pu(A, e)
}
function Gp() {
    return null
}
var Bd = typeof reportError == "function" ? reportError : function(A) {
    console.error(A)
}
;
function Qa(A) {
    this._internalRoot = A
}
zl.prototype.render = Qa.prototype.render = function(A) {
    var e = this._internalRoot;
    if (e === null)
        throw Error(S(409));
    bl(A, e, null, null)
}
;
zl.prototype.unmount = Qa.prototype.unmount = function() {
    var A = this._internalRoot;
    if (A !== null) {
        this._internalRoot = null;
        var e = A.containerInfo;
        mt(function() {
            bl(null, A, null, null)
        }),
        e[Me] = null
    }
}
;
function zl(A) {
    this._internalRoot = A
}
zl.prototype.unstable_scheduleHydration = function(A) {
    if (A) {
        var e = zs();
        A = {
            blockedOn: null,
            target: A,
            priority: e
        };
        for (var t = 0; t < Pe.length && e !== 0 && e < Pe[t].priority; t++)
            ;
        Pe.splice(t, 0, A),
        t === 0 && Vs(A)
    }
}
;
function _a(A) {
    return !(!A || A.nodeType !== 1 && A.nodeType !== 9 && A.nodeType !== 11)
}
function gl(A) {
    return !(!A || A.nodeType !== 1 && A.nodeType !== 9 && A.nodeType !== 11 && (A.nodeType !== 8 || A.nodeValue !== " react-mount-point-unstable "))
}
function wu() {}
function Ip(A, e, t, n, r) {
    if (r) {
        if (typeof n == "function") {
            var l = n;
            n = function() {
                var y = ul(a);
                l.call(y)
            }
        }
        var a = Yd(e, n, A, 0, null, !1, !1, "", wu);
        return A._reactRootContainer = a,
        A[Me] = a.current,
        Jn(A.nodeType === 8 ? A.parentNode : A),
        mt(),
        a
    }
    for (; r = A.lastChild; )
        A.removeChild(r);
    if (typeof n == "function") {
        var u = n;
        n = function() {
            var y = ul(s);
            u.call(y)
        }
    }
    var s = Ya(A, 0, !1, null, null, !1, !1, "", wu);
    return A._reactRootContainer = s,
    A[Me] = s.current,
    Jn(A.nodeType === 8 ? A.parentNode : A),
    mt(function() {
        bl(e, s, t, n)
    }),
    s
}
function Vl(A, e, t, n, r) {
    var l = t._reactRootContainer;
    if (l) {
        var a = l;
        if (typeof r == "function") {
            var u = r;
            r = function() {
                var s = ul(a);
                u.call(s)
            }
        }
        bl(e, a, A, r)
    } else
        a = Ip(t, e, A, r, n);
    return ul(a)
}
Ms = function(A) {
    switch (A.tag) {
    case 3:
        var e = A.stateNode;
        if (e.current.memoizedState.isDehydrated) {
            var t = Nn(e.pendingLanes);
            t !== 0 && (ma(e, t | 1),
            RA(e, uA()),
            !(C & 6) && ($t = uA() + 500,
            Be()))
        }
        break;
    case 13:
        mt(function() {
            var n = be(A, 1);
            if (n !== null) {
                var r = qA();
                ue(n, A, 1, r)
            }
        }),
        Ba(A, 1)
    }
}
;
La = function(A) {
    if (A.tag === 13) {
        var e = be(A, 134217728);
        if (e !== null) {
            var t = qA();
            ue(e, A, 134217728, t)
        }
        Ba(A, 134217728)
    }
}
;
bs = function(A) {
    if (A.tag === 13) {
        var e = Ee(A)
          , t = be(A, e);
        if (t !== null) {
            var n = qA();
            ue(t, A, e, n)
        }
        Ba(A, e)
    }
}
;
zs = function() {
    return I
}
;
gs = function(A, e) {
    var t = I;
    try {
        return I = A,
        e()
    } finally {
        I = t
    }
}
;
Mi = function(A, e, t) {
    switch (e) {
    case "input":
        if (Li(A, t),
        e = t.name,
        t.type === "radio" && e != null) {
            for (t = A; t.parentNode; )
                t = t.parentNode;
            for (t = t.querySelectorAll("input[name=" + JSON.stringify("" + e) + '][type="radio"]'),
            e = 0; e < t.length; e++) {
                var n = t[e];
                if (n !== A && n.form === A.form) {
                    var r = xl(n);
                    if (!r)
                        throw Error(S(90));
                    ls(n),
                    Li(n, r)
                }
            }
        }
        break;
    case "textarea":
        as(A, t);
        break;
    case "select":
        e = t.value,
        e != null && Ht(A, !!t.multiple, e, !1)
    }
}
;
ps = Fa;
ys = mt;
var Yp = {
    usingClientEntryPoint: !1,
    Events: [er, Pt, xl, cs, fs, Fa]
}
  , mn = {
    findFiberByHostInstance: ot,
    bundleType: 0,
    version: "18.3.1",
    rendererPackageName: "react-dom"
}
  , Bp = {
    bundleType: mn.bundleType,
    version: mn.version,
    rendererPackageName: mn.rendererPackageName,
    rendererConfig: mn.rendererConfig,
    overrideHookState: null,
    overrideHookStateDeletePath: null,
    overrideHookStateRenamePath: null,
    overrideProps: null,
    overridePropsDeletePath: null,
    overridePropsRenamePath: null,
    setErrorHandler: null,
    setSuspenseHandler: null,
    scheduleUpdate: null,
    currentDispatcherRef: ge.ReactCurrentDispatcher,
    findHostInstanceByFiber: function(A) {
        return A = Ls(A),
        A === null ? null : A.stateNode
    },
    findFiberByHostInstance: mn.findFiberByHostInstance || Gp,
    findHostInstancesForRefresh: null,
    scheduleRefresh: null,
    scheduleRoot: null,
    setRefreshHandler: null,
    getCurrentFiber: null,
    reconcilerVersion: "18.3.1-next-f1338f8080-20240426"
};
if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var hr = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hr.isDisabled && hr.supportsFiber)
        try {
            yl = hr.inject(Bp),
            ye = hr
        } catch {}
}
GA.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = Yp;
GA.createPortal = function(A, e) {
    var t = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
    if (!_a(e))
        throw Error(S(200));
    return Cp(A, e, null, t)
}
;
GA.createRoot = function(A, e) {
    if (!_a(A))
        throw Error(S(299));
    var t = !1
      , n = ""
      , r = Bd;
    return e != null && (e.unstable_strictMode === !0 && (t = !0),
    e.identifierPrefix !== void 0 && (n = e.identifierPrefix),
    e.onRecoverableError !== void 0 && (r = e.onRecoverableError)),
    e = Ya(A, 1, !1, null, null, t, !1, n, r),
    A[Me] = e.current,
    Jn(A.nodeType === 8 ? A.parentNode : A),
    new Qa(e)
}
;
GA.findDOMNode = function(A) {
    if (A == null)
        return null;
    if (A.nodeType === 1)
        return A;
    var e = A._reactInternals;
    if (e === void 0)
        throw typeof A.render == "function" ? Error(S(188)) : (A = Object.keys(A).join(","),
        Error(S(268, A)));
    return A = Ls(e),
    A = A === null ? null : A.stateNode,
    A
}
;
GA.flushSync = function(A) {
    return mt(A)
}
;
GA.hydrate = function(A, e, t) {
    if (!gl(e))
        throw Error(S(200));
    return Vl(null, A, e, !0, t)
}
;
GA.hydrateRoot = function(A, e, t) {
    if (!_a(A))
        throw Error(S(405));
    var n = t != null && t.hydratedSources || null
      , r = !1
      , l = ""
      , a = Bd;
    if (t != null && (t.unstable_strictMode === !0 && (r = !0),
    t.identifierPrefix !== void 0 && (l = t.identifierPrefix),
    t.onRecoverableError !== void 0 && (a = t.onRecoverableError)),
    e = Yd(e, null, A, 1, t ?? null, r, !1, l, a),
    A[Me] = e.current,
    Jn(A),
    n)
        for (A = 0; A < n.length; A++)
            t = n[A],
            r = t._getVersion,
            r = r(t._source),
            e.mutableSourceEagerHydrationData == null ? e.mutableSourceEagerHydrationData = [t, r] : e.mutableSourceEagerHydrationData.push(t, r);
    return new zl(e)
}
;
GA.render = function(A, e, t) {
    if (!gl(e))
        throw Error(S(200));
    return Vl(null, A, e, !1, t)
}
;
GA.unmountComponentAtNode = function(A) {
    if (!gl(A))
        throw Error(S(40));
    return A._reactRootContainer ? (mt(function() {
        Vl(null, null, A, !1, function() {
            A._reactRootContainer = null,
            A[Me] = null
        })
    }),
    !0) : !1
}
;
GA.unstable_batchedUpdates = Fa;
GA.unstable_renderSubtreeIntoContainer = function(A, e, t, n) {
    if (!gl(t))
        throw Error(S(200));
    if (A == null || A._reactInternals === void 0)
        throw Error(S(38));
    return Vl(A, e, t, !1, n)
}
;
GA.version = "18.3.1-next-f1338f8080-20240426";
function Qd() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
        try {
            __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(Qd)
        } catch (A) {
            console.error(A)
        }
}
Qd(),
Qu.exports = GA;
var Qp = Qu.exports
  , Uu = Qp;
di.createRoot = Uu.createRoot,
di.hydrateRoot = Uu.hydrateRoot;
const _d = "https://vrjdholzmmnnyzkcjome.supabase.co"
  , sl = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyamRob2x6bW1ubnl6a2Nqb21lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjY5NzMsImV4cCI6MjA5NDAwMjk3M30.NrZFIsJfBos6sLMQS4HlEOzZcdfBBDxzL-YTRPhVFZc"
  , o = {
    bg: "var(--bg)",
    surface: "var(--surface)",
    card: "var(--card)",
    border: "var(--border)",
    primary: "var(--primary)",
    primaryDim: "var(--primary-dim)",
    onPrimary: "var(--on-primary)",
    accent: "var(--accent)",
    gold: "var(--gold)",
    silver: "var(--silver)",
    bronze: "var(--bronze)",
    green: "var(--green)",
    greenDim: "var(--green-dim)",
    win: "var(--win)",
    warn: "var(--warn)",
    error: "var(--error)",
    text: "var(--text)",
    textMid: "var(--text-mid)",
    textDim: "var(--text-dim)",
    meBg: "var(--me-bg)",
    headerGrad: "var(--header-grad)"
}
  , H = (A, e) => `color-mix(in srgb, ${A} ${e}%, transparent)`
  , $d = "linear-gradient(90deg,#009739 0 33%,#ffdf00 33% 66%,#002776 66% 100%)"
  , _p = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`;
function $p() {
    if (typeof document > "u")
        return;
    const A = ["#009739", "#ffdf00", "#002776", "#ffffff", "#2f80ed"]
      , e = document.createElement("div");
    e.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:400;overflow:hidden";
    for (let t = 0; t < 40; t++) {
        const n = document.createElement("div")
          , r = 6 + Math.floor(Math.random() * 8);
        n.style.cssText = `position:absolute;top:-14px;left:${Math.random() * 100}%;width:${r}px;height:${r}px;background:${A[t % A.length]};border-radius:${Math.random() < .5 ? "50%" : "2px"};opacity:.9;transform:rotate(${Math.random() * 360}deg);animation:confFall ${.9 + Math.random() * .9}s ${Math.random() * .25}s ease-in forwards`,
        e.appendChild(n)
    }
    document.body.appendChild(e),
    setTimeout( () => e.remove(), 2200)
}
function dl(A) {
    const e = [...document.querySelectorAll(".campo-placar")]
      , t = e.indexOf(A);
    for (let n = t + 1; n < e.length; n++)
        if (e[n].value === "") {
            e[n].focus();
            try {
                e[n].select()
            } catch {}
            return
        }
}
const Qn = {
    usee: {
        nome: "Usee",
        icone: "🔵",
        vars: {
            "--bg": "#0a1726",
            "--surface": "#0f2238",
            "--card": "#122845",
            "--border": "#2a486b",
            "--primary": "#1f6fe0",
            "--primary-dim": "rgba(31,111,224,.16)",
            "--on-primary": "#ffffff",
            "--accent": "#60a5fa",
            "--gold": "#f5c518",
            "--silver": "#a8b2c0",
            "--bronze": "#c47c3a",
            "--green": "#22c55e",
            "--green-dim": "rgba(34,197,94,.14)",
            "--win": "#60a5fa",
            "--warn": "#f59e0b",
            "--error": "#f87171",
            "--text": "#eaf1fb",
            "--text-mid": "#9fb3cc",
            "--text-dim": "#8aa6c4",
            "--me-bg": "#10294a",
            "--header-grad": "linear-gradient(160deg,rgba(31,111,224,.20) 0%,#0f2238 60%)"
        }
    },
    brasil: {
        nome: "Brasil",
        icone: "🇧🇷",
        vars: {
            "--bg": "#063d22",
            "--surface": "#0a5230",
            "--card": "#0d6138",
            "--border": "#1f7d4f",
            "--primary": "#ffdf00",
            "--primary-dim": "rgba(255,223,0,.15)",
            "--on-primary": "#063d22",
            "--accent": "#ffdf00",
            "--gold": "#ffdf00",
            "--silver": "#cfd6e0",
            "--bronze": "#f2bd80",
            "--green": "#39ff88",
            "--green-dim": "rgba(57,255,136,.12)",
            "--win": "#7ab8ff",
            "--warn": "#ffd23f",
            "--error": "#ffb8b8",
            "--text": "#ffffff",
            "--text-mid": "#d4f0e0",
            "--text-dim": "#9fd4b5",
            "--me-bg": "#0a5230",
            "--header-grad": "linear-gradient(160deg,rgba(255,223,0,.18) 0%,#0a5230 60%)"
        }
    },
    weesu: {
        nome: "Weesu",
        icone: "🟦",
        vars: {
            "--bg": "#06201f",
            "--surface": "#0a2e2c",
            "--card": "#0e3a37",
            "--border": "#1d5852",
            "--primary": "#0fb5a6",
            "--primary-dim": "rgba(15,181,166,.16)",
            "--on-primary": "#04201d",
            "--accent": "#5eead4",
            "--gold": "#f5c518",
            "--silver": "#a8b2c0",
            "--bronze": "#c47c3a",
            "--green": "#22c55e",
            "--green-dim": "rgba(34,197,94,.14)",
            "--win": "#38bdf8",
            "--warn": "#f59e0b",
            "--error": "#fb7185",
            "--text": "#e6fffb",
            "--text-mid": "#9fd3cc",
            "--text-dim": "#7fb3ac",
            "--me-bg": "#0c3b36",
            "--header-grad": "linear-gradient(160deg,rgba(15,181,166,.20) 0%,#0a2e2c 60%)"
        }
    },
    nor: {
        nome: "NØR",
        icone: "⚫",
        vars: {
            "--bg": "#0a0a0a",
            "--surface": "#151515",
            "--card": "#1c1c1c",
            "--border": "#363636",
            "--primary": "#fafafa",
            "--primary-dim": "rgba(250,250,250,.12)",
            "--on-primary": "#0a0a0a",
            "--accent": "#e0e0e0",
            "--gold": "#f5c518",
            "--silver": "#a8b2c0",
            "--bronze": "#c47c3a",
            "--green": "#22c55e",
            "--green-dim": "rgba(34,197,94,.14)",
            "--win": "#60a5fa",
            "--warn": "#f59e0b",
            "--error": "#f87171",
            "--text": "#fafafa",
            "--text-mid": "#b3b3b3",
            "--text-dim": "#8f8f8f",
            "--me-bg": "#242424",
            "--header-grad": "linear-gradient(160deg,rgba(255,255,255,.10) 0%,#151515 60%)"
        }
    }
}
  , Wu = "usee"
  , A1 = Object.entries(Qn).map( ([A,e]) => `:root[data-theme="${A}"]{${Object.entries(e.vars).map( ([t,n]) => `${t}:${n}`).join(";")}}`).join(`
`)
  , Ac = () => {
    try {
        const A = localStorage.getItem("bolao_tema");
        return A && Qn[A] ? A : Wu
    } catch {
        return Wu
    }
}
  , ec = A => {
    document.documentElement.dataset.theme = A;
    try {
        localStorage.setItem("bolao_tema", A)
    } catch {}
    const e = typeof document < "u" && document.querySelector('meta[name="theme-color"]');
    e && Qn[A] && e.setAttribute("content", Qn[A].vars["--bg"])
}
;
if (typeof document < "u") {
    if (!document.getElementById("theme-vars")) {
        const A = document.createElement("style");
        A.id = "theme-vars",
        A.textContent = A1,
        document.head.appendChild(A)
    }
    ec(Ac())
}
const lt = async (A, e={}) => {
    const t = await fetch(_d + "/rest/v1/" + A, {
        headers: {
            apikey: sl,
            Authorization: "Bearer " + sl,
            "Content-Type": "application/json",
            Prefer: e.prefer || "return=representation"
        },
        ...e
    });
    if (!t.ok) {
        const r = await t.text();
        throw new Error(r)
    }
    const n = await t.text();
    return n ? JSON.parse(n) : null
}
  , e1 = async A => {
    let t = 0
      , n = [];
    for (; ; ) {
        const r = await fetch(_d + "/rest/v1/" + A, {
            headers: {
                apikey: sl,
                Authorization: "Bearer " + sl,
                "Range-Unit": "items",
                Range: `${t}-${t + 1e3 - 1}`
            }
        });
        if (!r.ok) {
            const u = await r.text();
            throw new Error(u)
        }
        const l = await r.text()
          , a = l ? JSON.parse(l) : [];
        if (n = n.concat(a),
        a.length < 1e3)
            break;
        t += 1e3
    }
    return n
}
  , vA = {
    getPalpites: () => e1("palpites?select=*&order=participante_id"),
    getCampeoes: () => lt("palpite_campeao?select=*"),
    getJogos: () => lt("jogos?select=*&order=id"),
    getConfig: () => lt("config?select=*"),
    salvarPalpite: (A, e, t, n) => lt("palpites?on_conflict=participante_id,jogo_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: JSON.stringify({
            participante_id: A,
            jogo_id: e,
            gols_casa: t,
            gols_fora: n,
            confirmado: !0
        })
    }),
    salvarCampeao: (A, e) => lt("palpite_campeao?on_conflict=participante_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: JSON.stringify({
            participante_id: A,
            selecao: e
        })
    }),
    salvarResultado: (A, e, t) => lt(`jogos?id=eq.${A}`, {
        method: "PATCH",
        body: JSON.stringify({
            gols_casa: e,
            gols_fora: t
        })
    }),
    salvarConfig: (A, e) => lt("config", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: JSON.stringify({
            chave: A,
            valor: e
        })
    })
}
  , tc = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyBpZD0iQ2FtYWRhXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmVyc2lvbj0iMS4xIiB2aWV3Qm94PSIwIDAgODQxLjg5IDU5NS4yOCI+CiAgPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDMwLjMuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDIuMS4zIEJ1aWxkIDE4MikgIC0tPgogIDxkZWZzPgogICAgPHN0eWxlPgogICAgICAuc3QwIHsKICAgICAgICBmaWxsOiAjZmZmOwogICAgICB9CiAgICA8L3N0eWxlPgogIDwvZGVmcz4KICA8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMjQxLjExLDM5MC44M2MtMTIuMzcsMi40MS0yMi42NiwyLjk4LTMzLjQzLDIuNTgtODMuNDktMy4xNS0xNTEuNDEtNzUuNTItMTUxLjQxLTE2MS4zMXYtMTMuN2MwLTguMTEsNS40Mi0xNS41OCwxMy4zNy0xNy4yLDEwLjg2LTIuMjEsMjAuNDMsNi4wNiwyMC40MywxNi41NHYxOC4zMWMwLDY2LjkzLDU0LjQzLDEyMi40MSwxMjEuMzMsMTIzLjY2bDIuMjUuMDJjMzIuOSwwLDYzLjk5LTEzLjQsODcuNTQtMzcuNzUsNi4zNy02LjU5LDExLjk0LTEzLjc0LDE2LjctMjEuMzJ2LTEwNC45OGMwLTIyLjUxLTE4LjI1LTQwLjc2LTQwLjc2LTQwLjc2SDc0LjExYy0yMi41MSwwLTQwLjc2LDE4LjI1LTQwLjc2LDQwLjc2djIwMy4wMWMwLDIyLjUxLDE4LjI1LDQwLjc2LDQwLjc2LDQwLjc2aDIwMy4wMWMyMi41MSwwLDQwLjc2LTE4LjI1LDQwLjc2LTQwLjc2di00Ni41NWMtMjEuMDQsMTkuMTgtNDcuMjQsMzIuOTQtNzYuNzcsMzguNjlaTTEyOS4xNywyMTQuODZjMS43LTYuNDIsNi45LTExLjYyLDEzLjMzLTEzLjMzLDE0LjYzLTMuODgsMjcuNjYsOS4xNiwyMy43OCwyMy43OC0xLjcsNi40Mi02LjksMTEuNjItMTMuMzMsMTMuMzMtMTQuNjMsMy44OC0yNy42Ni05LjE2LTIzLjc4LTIzLjc4WiIvPgogIDxnPgogICAgPGc+CiAgICAgIDxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik02MDEuOTMsMzE0LjQ2YzguOTgsNi4yOSwyMC4zNiw5LjYxLDMyLjkzLDkuNjEsMTMuMzgsMCwyMy4yMi0yLjg5LDMyLjktOS42OCw2LjY3LTQuOTQsMTEuNTMtMTAuNzMsMTQuNDUtMTcuMjEsMS4yNC0yLjc3LDEuMTYtNS44OS0uMjQtOC41NS0xLjM4LTIuNjItMy44My00LjQ0LTYuNzQtNC45OGwtMS4wOC0uMmMtLjU4LS4xMS0xLjE4LS4xNi0xLjc4LS4xNi0zLjg0LDAtNy4yOSwyLjI2LTguNzksNS43NS0zLjg2LDkuMDUtMTUuOTQsMTUuNjEtMjguNzIsMTUuNjFzLTIzLjM4LTUuNi0yOC4wMi0xNGMtLjg5LTEuNjItMS41LTMuMjQtMS44MS00Ljg2LS41Mi0yLjQ1LS45OC01LjU1LTEuMzctOS4yNi0uNzQtNS42MS0xLjAxLTExLjc1LS44Mi0xOC4yMywwLS4yNywwLS41My0uMDYtLjguMzktOC44NSwxLjEzLTE1LjcyLDIuMjYtMjEsMi4wNy0xMC40OSwxNS40MS0xOS4wMiwyOS43NS0xOS4wMiwyMi42NiwwLDI4LjQsMTEuOTQsMjkuODEsMTkuMDguNjgsMy4xOSwxLjE5LDUuNzcsMS41Niw5Ljg3LjAzLjM3LS4wOC43Mi0uMzEuOTktLjIyLjI3LS41NC40My0xLjA1LjQ3bC0zMS40NCw0LjYzYy01LjE3LjQxLTkuMTMsNS4wMS04Ljg0LDEwLjI1LjI4LDUuMSw0LjUxLDkuMSw5LjYxLDkuMS4yNSwwLC41LDAsLjg2LS4wNGw0My4yMy01LjU1YzQuOTctLjQsOC44Ny00LjY2LDguODYtOS43NS0uMzgtMTAuMTctMS4xMS0xNy4zMi0yLjQ2LTIzLjkxLTEuOTEtOS4zMi04LjA2LTE4LjItMTYuODQtMjQuMzUtOC45MS02LjU5LTIwLjYzLTEwLjIzLTMzLjAxLTEwLjIzcy0yNCwzLjYzLTMyLjg5LDEwLjIxYy04LjQyLDYuMTUtMTQuNTYsMTUuMDItMTYuODcsMjQuNC0zLjEyLDE1Ljg3LTMuMTEsNDEuNDkuMDQsNTcuMTYsMi4yLDkuMjcsOC4wMywxNy43NiwxNi45LDI0LjYxWiIvPgogICAgICA8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNTI2LjQsMzIzLjQ0YzEzLjE4LDAsMjQuNzQtNC45OCwzMi41Mi0xMy45OSw1LjAxLTUuMzksNy44OC0xMi43Myw3Ljg4LTIwLjA2LjM5LTcuOC0yLjEtMTUuMjMtNi44My0yMC4zOC0zLjk5LTQuNDItMTIuMTgtOS45OS0yNi44NC0xOS4zNGwtMS4yOS0uODdjLTYuMDQtNC4wNi0xOC42LTEyLjUtMjAuMTgtMTQuNDgtNC41My01LjQ0LjQ2LTEwLjg3LDIuMTMtMTIuNDQsMy4xLTMuMTQsNy40NC00LjU1LDE0LjA3LTQuNTUsNi4yNiwwLDEzLjM2LDQuMTIsMTYuMTcsOS4zNywxLjczLDMuMjQsNS4wMyw1LjI1LDguNTksNS4yNS41MiwwLDEuMDQtLjA0LDEuNTQtLjEybC42OC0uMTFjMy4wNS0uNTEsNS43LTIuNDcsNy4wOC01LjI0LDEuMzktMi44LDEuMzUtNS45OC0uMS04Ljc0LTIuMzgtNC41MS01Ljg0LTguNDQtMTAuMjgtMTEuNjYtNi42Ny00Ljg2LTE1Ljg4LTcuODgtMjQuMDItNy44OC0xMS4wNCwwLTE5LjY1LDEuNjUtMjguNDcsOS45LTguNjMsOC43NS0xNC42OSwyMy45OS0zLjMzLDM4LjE0LDMuNDcsNC4zMywxMi4xNiwxMC4xNiwyNi4wOCwxOS4yNywxNy45NywxMS40LDIxLjkzLDE0Ljk5LDIyLjgxLDE2LjAxLDMuNDQsMy45LDIuOTgsMTAuOTMtMSwxNS4zNS0yLjkxLDMuMjYtOC4yNSw3LjE1LTE3LjIsNy4xNS0xMi42OCwwLTE4LjAxLTUuNDMtMjAuMjYtOS45OS0xLjYtMy4yNS00Ljg4LTUuMjctOC41Ni01LjI3LS43MSwwLTEuNDIuMDgtMi4wOC4yM2wtLjc4LjE3Yy0yLjk2LjY1LTUuMzksMi41OS02LjY4LDUuMzMtMS4yNywyLjctMS4yMiw1Ljc3LjE0LDguNDIsMy4xOCw2LjE3LDEzLjI1LDIwLjUzLDM4LjIzLDIwLjUzWiIvPgogICAgICA8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNzIyLjU1LDMxNC40NmM4Ljk4LDYuMjksMjAuMzYsOS42MSwzMi45Myw5LjYxLDEzLjM4LDAsMjMuMjItMi44OSwzMi45LTkuNjgsNi42Ny00Ljk0LDExLjUzLTEwLjczLDE0LjQ0LTE3LjIxLDEuMjUtMi43NywxLjE2LTUuODktLjI0LTguNTUtMS4zNy0yLjYyLTMuODMtNC40NC02Ljc0LTQuOThsLTEuMDktLjJjLS41OC0uMTEtMS4xOC0uMTYtMS43OC0uMTYtMy44NCwwLTcuMjksMi4yNi04Ljc5LDUuNzUtMy44Niw5LjA1LTE1Ljk0LDE1LjYxLTI4LjcyLDE1LjYxcy0yMy4zOC01LjYtMjguMDMtMTRjLS44OS0xLjYyLTEuNS0zLjI1LTEuODEtNC44Ni0uNTMtMi40NS0uOTktNS41NS0xLjM3LTkuMjUtLjc0LTUuNjEtMS4wMS0xMS43NS0uODItMTguMjMsMC0uMjcsMC0uNTMtLjA2LS44LjM5LTguODUsMS4xMy0xNS43MiwyLjI2LTIxLDIuMDctMTAuNDksMTUuNDEtMTkuMDIsMjkuNzUtMTkuMDIsMjIuNjYsMCwyOC40LDExLjk0LDI5LjgxLDE5LjA4LjY4LDMuMiwxLjIsNS43OSwxLjU2LDkuODguMDMuMzctLjA4LjcyLS4zMS45OS0uMjIuMjctLjU0LjQzLTEuMDUuNDdsLTMxLjQ0LDQuNjNjLTUuMTcuNDEtOS4xMyw1LjAxLTguODQsMTAuMjUuMjgsNS4xLDQuNSw5LjEsOS42MSw5LjEuMjUsMCwuNSwwLC44NS0uMDRsNDMuMjMtNS41NWM0Ljk3LS40LDguODctNC42Niw4Ljg3LTkuNzUtLjM4LTEwLjE3LTEuMTEtMTcuMzMtMi40Ni0yMy45MS0xLjkyLTkuMzItOC4wNi0xOC4yLTE2Ljg0LTI0LjM1LTguOTEtNi41OS0yMC42My0xMC4yMy0zMy4wMS0xMC4yM3MtMjQsMy42My0zMi44OSwxMC4yMWMtOC40Miw2LjE1LTE0LjU2LDE1LjAyLTE2Ljg3LDI0LjQtMy4xMiwxNS44Ny0zLjExLDQxLjQ5LjA0LDU3LjE2LDIuMiw5LjI3LDguMDMsMTcuNzYsMTYuOSwyNC42MVoiLz4KICAgICAgPHBhdGggY2xhc3M9InN0MCIgZD0iTTM5My40MSwzMTQuMWM4LjgsNi40NCwxOS40MSw5Ljk4LDI5Ljg5LDkuOThoMi4wM2MxMC41NCwwLDIxLjU3LTMuNjUsMzAuMjgtMTAuMDIsMTAuMDItNy41NywxNS41NC0xOC4xOSwxNS41NC0yOS45MXYtNzYuNTljMC01LjM1LTQuNDEtOS44Ni05LjYzLTkuODZoLS45M2MtNS4yMiwwLTkuNjMsNC41Mi05LjYzLDkuODZ2NzYuNTljMCwxMy4zOC0xNC44OCwyMC41MS0yNS42MywyMC41MWgtMi4wM2MtMTAuNiwwLTI1LjI5LTcuMTMtMjUuMjktMjAuNTF2LTc2LjU5YzAtNS4zNS00LjQxLTkuODYtOS42My05Ljg2aC0uOTNjLTUuMjIsMC05LjYzLDQuNTItOS42Myw5Ljg2djc2LjU5YzAsMTIsNS41NCwyMi42NCwxNS41OSwyOS45NVoiLz4KICAgIDwvZz4KICAgIDxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik03MDIuMTcsMzYxLjU0Yy0uODctLjk3LTEuMDMtMi4xNi0uNDMtMy4yNS40Ni0uNjksMS4wNC0xLjIsMS43Ni0xLjYxLjY1LS4zNywxLjMtLjY2LDEuOTItLjg1Ljc1LS4yNSwxLjU1LS4zOCwyLjM2LS4zOC43NSwwLDEuNTIuMTIsMi4yOC4zNC41NC4wNSwxLjA5LjMyLDEuNjkuODIuNjUuMTYsMS4yMy40NCwxLjcyLjgyLjY1LjUxLDEuMDcsMS4yMiwxLjIxLDIuMDYuMTEuNjcuMDMsMS42NS0uOTYsMi41NS0uMDguMDctLjE3LjEzLS4yNi4xOC0xLjE3LjU5LTIuNDIsMS4wNC0zLjcyLDEuMzMtLjk1LjE5LTEuODMuMjgtMi42Ni4yOC0uOTIsMC0xLjgzLS4yLTIuNzEtLjYtLjgzLS40MS0xLjU2LS45Ny0yLjItMS42OVpNNDA3LjQyLDM4MS4wNWMuMjEuMjIuNC40LjU0LjUyLjI3LjI1LjY0LjQzLDEuMTguNTcuMjMuMDUuNTQuMS45LjEzLjA0LDAsLjIuMDEuMjQuMDEuNTgsMCwxLjEtLjIzLDEuNDMtLjYsMS4xOS0xLjIzLDIuMzItMi41NiwzLjM3LTMuOTUsMS4wMy0xLjM3LDIuMDQtMi43MywzLTQuMDgsMS0xLjM1LDIuMDMtMi42OSwzLjA5LTQuMDQsMS4wOS0xLjM5LDIuMTItMi44NywzLjExLTQuNDYuMzMtLjYuMzEtMS4yOC0uMDctMS44OC0uMjYtLjQtLjYxLS43Mi0xLjA3LS45Ni0uNC0uMjEtLjg1LS4zNC0xLjMyLS4zOC0uMDQsMC0uMi0uMDEtLjI0LS4wMS0uNiwwLTEuMTIuMjMtMS40OS42NC0xLjE0LDEuMy0yLjIzLDIuNjItMy4yOSwzLjk4LTEuMDQsMS4zMi0yLjA5LDIuNjItMy4xOCwzLjkxLTEuMDMsMS4yNi0yLjEyLDIuNTItMy4yOSwzLjc4LTEuMjIsMS4zMi0yLjMyLDIuNzItMy4yOCw0LjE2LS4zNC41Mi0uMzksMS4xNC0uMTUsMS43LjExLjI2LjIzLjUuMzYuNzMuMDUuMDkuMTEuMTYuMTcuMjNaTTgwNy42OCwzNzEuMTRjMCwuOTItLjQ0LDEuNjgtMS4yNSwyLjE0LS40OS4yOC0xLC40Mi0xLjU0LjQyLS4yMywwLS40Ny0uMDMtLjctLjA4LTIuNjctLjUzLTUuNDQtLjgxLTguMjEtLjg0aC0uNTJjLTIuNjEsMC01LjIyLjE4LTcuNzYuNTMtMi43NS4zOC01LjQ5LjktOC4xNSwxLjU1LTIuNjguNjUtNS4zNywxLjM5LTguMDIsMi4yLTUuNDcsMS41OC0xMC44NCwzLjQ0LTE1Ljk4LDUuNTMtNS4yMSwyLjEyLTEwLjQyLDQuMzItMTUuNDksNi41NC0uNDIuMjEtLjkyLjM0LTEuNDUuMzQtLjE5LDAtLjM4LS4wMi0uNTgtLjA1LS41OS0uMS0xLjE1LS4zLTEuNjgtLjU2LS41My0uMjctMS4wMi0uNjItMS40NS0xLjAzLS40Ni0uNDUtLjc5LS45My0uOTgtMS40Mi0uNDQtLjgyLS42LTEuNzktLjQzLTIuNzYuMTQtLjgyLjQxLTEuNjQuOC0yLjQyLjM3LS43Ni44NC0xLjQ5LDEuNC0yLjE2LjQ4LS41OS45My0xLjE3LDEuMzUtMS43NS43Ni0xLjAxLDEuNTctMi4wOCwyLjQ0LTMuMjEuMTYtLjIxLjMzLS40Mi41Mi0uNjYtMi4zOC4zNC00LjY5LjcxLTYuOSwxLjEtMy4wMi41NC02LjA4LDEuMTctOS4wOSwxLjg4LTIuOTkuNzEtNi4wMiwxLjUyLTguOTksMi40MS0zLjAzLjktNi4yMSwxLjktOS41NCwzLTEuNzIuNi0zLjQ0LDEuMTktNS4xNSwxLjc3LTEuNzQuNTktMy41LDEuMTEtNS4yNSwxLjU1LS44NS4xOC0xLjcxLjM3LTIuNjIuNTgtLjk5LjI0LTEuOTguMzgtMi45NC40NC0uMjUuMDItLjUuMDItLjc0LjAyLS43NCwwLTEuNDgtLjA3LTIuMi0uMjEtMS4wOS0uMjEtMi4wNS0uNy0yLjgzLTEuNDctLjcxLS42My0xLjE4LTEuNC0xLjM1LTIuMjYtLjE2LS44LS4xMi0xLjYuMTItMi40LjIyLS43LjU0LTEuNC45Ny0yLjA2LjM5LS42Ljc4LTEuMTYsMS4xNi0xLjY4Ljc0LTEuMDEsMS42Mi0xLjk4LDIuNjMtMi45aDBjLTIuMTctLjIyLTQuNTEtLjMzLTYuOS0uMzMtLjQ4LDAtLjk3LDAtMS40Ni4wMS0yLjkzLjA2LTUuOTUuMjUtOC45Ni41Ny0zLjAxLjMyLTYuMDguOC05LjEzLDEuNDMtMy4wNS42Mi02LjAyLDEuMzUtOC44MywyLjE2bC00LjgxLDEuNDhjLS43Ny4yNC0xLjU1LjQ5LTIuMzMuNzYuMzQuMjEuNjYuNDMuOTguNjUsMS4xNy44MSwyLjAyLDEuODIsMi41NSwzLjAxLjUzLDEuNzguMiwzLjM1LS45Myw0LjY2LS45MiwxLjA4LTEuOTYsMi4wNS0zLjA4LDIuODctMi4zOSwxLjY2LTUuMDEsMy4wMS03LjgyLDQuMDMtMi44MSwxLjAyLTUuNzUsMS42OC04Ljc1LDEuOTYtMS4yNy4xMS0yLjY2LjE4LTQuMTguMjFoLS40M2MtMS40MSwwLTIuODEtLjEzLTQuMTUtLjM5LTEuNS0uMy0yLjkxLS43OS00LjE5LTEuNDgtMS4zNS0uNzItMi4zNy0xLjc4LTMuMDMtMy4xNC0uMjEtLjI3LS4zNi0uNjEtLjQ0LTEuMDQtLjEzLS42MSwwLTEuMjIuMzctMS43NiwyLjEzLTIuNSw0LjU2LTQuNTYsNy4yOC02LjI0LDIuNjctMS42NSw1LjU2LTMuMTMsOC41Ny00LjQxLjAyLDAsLjAzLS4wMi4wNS0uMDMtLjc4LS4yNy0xLjU4LS41OC0yLjM5LS45NC0uNTQtLjI2LTEuMDctLjU1LTEuNi0uODgtLjA4LDAtLjIyLDAtLjI1LS4wMS0uNzgtLjAyLTEuNjItLjAzLTIuNDYtLjAzLTUuNDcsMC0xMC45My40Ni0xNi4yNSwxLjM4LTYuMTQsMS4wNi0xMi4yMywyLjU4LTE4LjA5LDQuNTMtMy4wNS45Ny01Ljk4LDIuMDctOC43MywzLjI2LTEuNDMuNTgtMi44MiwxLjA1LTQuMTUsMS40Mi0uNjguMTktMS4zOS4yOC0yLjEyLjI4LS44NywwLTEuNzgtLjE0LTIuNzEtLjQxLS45OS0uMzEtMS45Mi0uNzctMi43OS0xLjM1LS41OC0uMzktMS4wOC0uODQtMS40OC0xLjM0LS43Ni4zNS0xLjUyLjY4LTIuMjgsMS0xLjEuNDYtMi4yNS44NC0zLjQyLDEuMTMtMS4xMy4yNS0yLjMuMzgtMy41LjM4LS4yNCwwLS40OSwwLS43My0uMDEtMS41Mi0uMDYtMi45OS0uNDMtNC4zNy0xLjExLTEuNTktLjkxLTIuNTQtMi4wNS0yLjktMy40NC0uMjYtMS4wMS0uMjYtMi41NywxLjI0LTQuMjYsMS41NC0xLjgzLDMuNDUtMy40NSw1LjY1LTQuOCwwLDAsLjAyLS4wMS4wMy0uMDItLjM2LjAxLS43My4wMy0xLjEuMDYtMi43NC4xOS01LjQ5LjUtOC4xNi45My0yLjcuNDQtNS40My45Ni04LjExLDEuNTUtMi43Ni42MS01LjU0LDEuMTQtOC4yNSwxLjU4LTEuMjcuMTctMi41NS4zNS0zLjg4LjU0LTEuMzguMi0yLjc5LjMyLTQuMTkuMzRoLS41NmMtMS4yMiwwLTIuNDQtLjA4LTMuNjMtLjI2LTEuNDEtLjIxLTIuNzctLjYxLTQuMDQtMS4yMS0xLjEzLS40Ny0yLjE5LTEuMTQtMy4wOS0xLjk4LS41OS0uNTUtMS4xMS0xLjEzLTEuNTYtMS43NS0yLjU5LDEuMzctNS4wOCwyLjgyLTcuNDEsNC4zMWwtNi4xNCwzLjg4LTMuMDQsMi4wNGMtLjI3LjE5LS41Mi4zNy0uNzMuNTMtLjE5LjE0LS4zOS4yNy0uNjEuMzctLjM4Ljg2LS44NSwxLjYxLTEuMzksMi4yNS0uNTQuNzItMS4zOCwxLjEyLTIuNDEsMS4xMi0xLjAzLS4wNC0xLjg3LS4yNC0yLjY5LS42LS44Ni0uMzgtMS41Ni0uOTItMi4wOC0xLjYtLjcyLS45My0uNzQtMi4wNC0uMDUtMi45NS41OS0uODEsMS4xMS0xLjk0LDEuNTMtMy4zNC40Mi0xLjQuNjEtMi41OS41Ni0zLjU1LDAtLjMtLjA3LS41OC0uMi0uOTEtLjIxLS41MS0uMzgtMS4wNC0uNTEtMS41OS0uMTUtLjU4LS4yMi0xLjE2LS4yMi0xLjczLDAtLjguMy0xLjQ5Ljg2LTEuOTkuNDYtLjQxLDEuMDQtLjYzLDEuNjctLjYzLjQxLDAsLjc5LjA0LDEuMTMuMTEsMS44Ny43MSwzLjEzLDEuOCwzLjkxLDMuMjkuNDMuODEuNzUsMS42Ny45OCwyLjU5bDMuNzYtMi42M2MyLjIyLTEuNDEsNC41Mi0yLjc0LDYuODYtMy45OSwyLjMzLTEuMjQsNC42OC0yLjQ0LDcuMDUtMy42LjM5LS4xOC44LS4yNSwxLjI1LS4yNS4zMiwwLC42Ni4wNCwxLjA0LjEyLjc5LjE3LDEuNTEuNDUsMi4xNS44Ni42OC40MywxLjIyLjk2LDEuNTksMS41OS41Mi44Ny40OCwxLjgzLS4wOSwyLjY1LS4xMS4yNC0uMTYuNjUtLjA4LDEuMTQuMDYuMzkuMjUuNjUuNjIuODYuNS4zMiwxLjA5LjQ3LDEuOC40NywxLjEzLS4wMywyLjAzLS4wOSwyLjg3LS4yLDIuMjQtLjE3LDQuNDYtLjQ0LDYuNjQtLjgyLDIuMjItLjM4LDQuNC0uNzksNi41Ni0xLjIzbDYuNy0xLjMyYzIuMjUtLjQ1LDQuNTUtLjgsNi44NC0xLjA1LDIuMy0uMjUsNC42My0uMzksNi45NC0uNDJoLjU0YzIuMTYsMCw0LjM1LjE1LDYuNTIuNDcuODMuMTQsMS42OC40NCwyLjU0LjkyLjc0LjQxLDEuMjguOTIsMS42LDEuNTIuMjktLjA0LjU3LS4wNy44Ny0uMS4zNC0uMDMuNjctLjA1LDEtLjA1LDEuMTksMCwyLjM2LjIyLDMuNDYuNjcuOC4zMiwxLjYzLjg0LDIuNDYsMS41Ni43Ny42NSwxLjI1LDEuMzksMS40NCwyLjE5Ljc3LjQsMS4zOS45MywxLjg0LDEuNTguNDguNy40OSwxLjMyLjQxLDEuNzItLjEyLjYzLS41MiwxLjE3LTEuMTksMS42MmwtLjAzLjAzLjUxLS4yMWMyLjQ0LS45NCw0Ljg4LTEuODEsNy4yOC0yLjU5LDIuMzktLjc3LDQuODYtMS41LDcuMzUtMi4xNiw1LjAzLTEuMjcsMTAuMTYtMi4yNiwxNS4yNC0yLjk1LDQuMTEtLjU2LDguMzItLjg0LDEyLjUyLS44NCwxLjAyLDAsMi4wMy4wMiwzLjA2LjA1aDBjLjI1LS40MS41OS0uNzgsMS4wMy0xLjA5LjgzLS42MSwxLjcyLS45OCwyLjY2LTEuMTIuMTEtLjAyLjI2LS4wMy40Mi0uMDMuNCwwLC44NC4wOSwxLjI5LjI3LjU4LjIyLDEuMDguNTMsMS40OC45Mi40OC40Ny43NSwxLC44MSwxLjU4LjAzLjMsMCwuOTMtLjU2LDEuNDkuNi4yOCwxLjIxLjUsMS44NC42OC44LjIzLDEuNTkuNDgsMi4zNi43Ny43MS4yOSwxLjM3LjU0LDIuMDEuNzkuNTIuMiwxLjA1LjQxLDEuNTkuNjIsMS44NS0uNzEsMy43Mi0xLjM4LDUuNTctMiwyLS42Niw0LjA2LTEuMyw2LjE4LTEuOTEsNi44My0yLjA0LDEzLjk1LTMuNDcsMjEuMTUtNC4yNCwyLjc0LS4zLDUuNTItLjQ1LDguMjgtLjQ1LDQuNTEsMCw5LjExLjQsMTMuNjYsMS4yLjQuMDYuODYuMTcsMS4zNi4zMy41MS4xNiwxLjAyLjM5LDEuNTEuNjkuNTUuMzQuOTguNzUsMS4zLDEuMjIuMy40Ni40NiwxLC40NSwxLjU3LjQ4LjI4Ljg2LjYsMS4xNC45Ny40OS42Ni41LDEuNDYuMDMsMi4xNi0uNTIuODctMS4yNCwxLjcyLTIuMSwyLjQ5LS43Mi42My0xLjM3LDEuMzEtMS45NCwyLjAybDIuNjMtLjc4YzYuNTItMi4xOCwxMy4xOC00LjI1LDE5Ljc1LTYuMTQsNi42Mi0xLjksMTMuODgtMy40MywyMS41OC00LjUzLDEuMjYtLjE3LDIuNjUtLjMzLDQuMTgtLjUuMzctLjA0LjczLS4wNiwxLjA4LS4wNiwxLjI0LDAsMi40Mi4yNSwzLjQ5Ljc0LDMuMTEtMy40Niw2LjQzLTYuNzcsOS44Ni05Ljg2LDQuMDUtMy42NSw4LjM2LTcuMTQsMTIuODMtMTAuMzgsMi4yOS0xLjY1LDQuNjctMy4yNyw3LjA3LTQuODIsMi4zNy0xLjUzLDQuODEtMy4wNCw3LjI0LTQuNDhsMy40OC0yLjA2YzEuMjgtLjc1LDIuNjItMS4zNywzLjk5LTEuODMsMS4zNC0uNDUsMi43MS0uNjgsNC4wNy0uNjgsMCwwLC4yMywwLC4yNCwwLDEuNTIuMDMsMy4wMy41Myw0LjUxLDEuNDYuNjUuMzYsMS4xOC45MiwxLjUxLDEuNjEuNDIuOTIuMjIsMS45LS41NSwyLjY5LTMuOTcsMy42My04LjAzLDcuMDgtMTIuMSwxMC4yOC00LjEsMy4yMi04LjQ0LDYuMzYtMTIuOSw5LjMzLTMuNjUsMi40Ny03LjQsNC44NS0xMS4xNSw3LjA4LTMuNzIsMi4yLTcuNjMsNC4yOC0xMS42NCw2LjE4LS43Mi44LTEuNCwxLjYtMi4wMSwyLjM5LS43My44My0xLjQxLDEuNi0yLjA4LDIuMzktLjY1Ljc2LTEuMjEsMS40NS0xLjY4LDIuMDgsMy4wNi0xLjMsNi4xNy0yLjU1LDkuMjgtMy43NCw0LjQ3LTEuNzEsOS4wOS0zLjI3LDEzLjc1LTQuNjUsMi44NC0uNzcsNS43NC0xLjQ3LDguNjQtMi4wOCwyLjg1LS42LDUuODEtMS4xMyw4LjgxLTEuNTgsMi41NC0uMzgsNS4xNS0uNTcsNy43NC0uNTcuNDksMCwuOTksMCwxLjQ4LjAyLDMuMTQuMDgsNi4yLjY1LDkuMSwxLjY3LjUzLjIsMS4wOC40OSwxLjcyLjksMS4xNC43NCwxLjM4LDEuNiwxLjM4LDIuMTlaTTU2OC40MywzNzQuNjljLS4wNi0uNDQtLjE5LS42NS0uMzctLjYyLS4xOS4wMy0uNTMuMS0xLjAyLjIxLS42OC4yOC0xLjM2LjQ0LTIuMDQuNDktLjY4LjI4LTEuMzUuNTQtMiwuNzgtLjY1LjI1LTEuMjkuNTYtMS45Ljk1LTEuMTEuNTUtMi4yLDEuMjEtMy4yNSwxLjk4LTEuMDUuNzctMS45OCwxLjYyLTIuNzksMi41Ni4zNywwLC43NC0uMDgsMS4xMi0uMjUuOC0uMjcsMS41OC0uNTYsMi4zMi0uODcuNzQtLjMsMS40OS0uNjIsMi4yMy0uOTUsMS4zLS42NiwyLjYtMS4zMywzLjktMi4wMiwxLjMtLjY5LDIuNTctMS4zOSwzLjgxLTIuMXYtLjE2Wk02NDAuMSwzODMuNTVjLS41Mi0uMy0xLS41Ni0xLjQ3LS43OWwtMS4yMy0uNmMtLjYxLjIyLTEuMi40NS0xLjc3LjcxbC0yLjIzLjk5Yy0yLjUsMS4wMy00LjkzLDIuMjEtNy4yNCwzLjUzLTEuNDIuODEtMi43NCwxLjc0LTMuOTYsMi43OGgxLjIzYzEuMTItLjA1LDIuMy0uMTgsMy40Ni0uMzksMS4xNC0uMjEsMi4yOS0uNSwzLjQyLS44NywyLjQxLS42NCw0LjYxLTEuNjIsNi42LTIuOTEuNTMtLjMsMS0uNiwxLjQ4LS45NS40OS0uMzYuOTQtLjcyLDEuMzUtMS4wOS0uMDEtLjAyLjEyLS4xNy4zNC0uNFpNNDY4LjMyLDM2NS41N2MtMS4zNi0uODktMi44MS0xLjY2LTQuMzEtMi4yNy0xLjQ4LS42LTMtMS4xLTQuNTQtMS40Ni0uNTQtLjEzLTEuMDgtLjI0LTEuNjEtLjMyLjQxLS40Mi43OS0uODYsMS4xNi0xLjM0LDEuMDQtMS4zNSwxLjYtMi44NywxLjY1LTQuNS4wNi0xLjg0LS41Ny0zLjQ1LTEuODctNC43OC0xLjE1LTEuMTctMi40OC0yLjE2LTQuMDMtMi45NS0zLjQzLTEuNDgtNy4xNy0yLjI5LTExLjEzLTIuNDEtMS0uMDMtMS45OS0uMDQtMi45OC0uMDQtMi43OSwwLTUuNTYuMTItOC4yLjM2LTMuNjMuMjYtNy40My43Ni0xMS4yOSwxLjUxLTMuODkuNzUtNy41NiwxLjktMTAuOTQsMy40Mi0uNTkuMjktMS4yNi42NC0yLjAyLDEuMDUtLjg1LjQ2LTEuNTcsMS4wMS0yLjE1LDEuNjQtLjYzLjY4LTEuMDUsMS40NS0xLjI0LDIuMjgtLjIzLjk4LjA0LDIsLjc4LDMuMDEsMS4xLDEuNTUsMi42NiwyLjcyLDQuNjYsMy41LDEuNDMuNTUsMi44NS44Myw0LjIyLjgzLjUyLDAsMS4wMy0uMDQsMS42Ny0uMTUuOTctLjI3LDEuMzQtLjgzLDEuNDgtMS4yNS4xOC0uNTYuMDktMS4xNi0uMjctMS42OC0uMjMtLjMzLS41NS0uNjQtLjk1LS45MS0uMzgtLjI2LS43Ny0uNDUtMS4yMS0uNTctLjMtLjA2LS43Mi0uMTgtMS4yOS0uMzQtLjU3LS4xNi0uODMtLjMyLS45My0uNDEtLjAzLS4wMy0uMDYtLjA1LS4xLS4wNy4xOC0uMjUuNTgtLjQ4LDEuMTQtLjY3Ljg3LS4yOSwxLjU4LS41NiwyLjA1LS43NywyLjkzLTEuMSw1Ljg5LTEuOSw4LjgxLTIuNDEsMy4xOC0uNjIsNi40NS0xLjA4LDkuNy0xLjM4LDIuNDMtLjIyLDQuOTEtLjMzLDcuMzYtLjMzLjgyLDAsMS42NS4wMSwyLjM3LjAzLjY2LjA4LDEuNDEuMTQsMi4yNC4xNi43NS4wMiwxLjUxLjA5LDIuMjguMi43NC4xLDEuNDUuMjcsMi4xMS40OC42MS4yLDEuMTUuNDYsMS41Ni43My4xNi4xMi4xNS4xNi4xMy4yNi0uMDguNDItLjI4Ljg2LS41OSwxLjMyLS4zNC41LS43NS45Ni0xLjIxLDEuMzUtLjU4LjQ5LS45My42OS0xLjMyLjg5LTEuMDcuNzUtMi4yOSwxLjM2LTMuNjIsMS44My0xLjM5LjQ4LTIuODMuODctNC4yOCwxLjE0LTEuNDkuMjgtMywuNDctNC40OC41Ny0xLjA5LjA3LTIuMTQuMTEtMy4xNC4xMS0uMzksMC0uNzgsMC0xLjI5LS4wMS0uODYuMDctMS41Ny4zOC0yLjEzLjkzLS42NC42My0uODksMS40OS0uNzIsMi4zOC4xNS45Ni41OCwxLjc0LDEuMjcsMi4zMS41Ni40NiwxLjI1LjgzLDIuMDMsMS4xMS43NC4yNiwxLjUzLjQ0LDIuMzMuNTMuNzIuMDgsMS4zNS4xNiwxLjk3LjI0LjUxLjA0LDEuMDQuMDcsMS41OC4wNy42NywwLDEuMzctLjAzLDIuMDktLjEsMS4yNS0uMTIsMi41My0uMjYsMy44Mi0uNDQsMS4yNC0uMTcsMi41My0uMywzLjg2LS4zNy41OC0uMDMsMS4xNy0uMDUsMS43Ni0uMDUuNzMsMCwxLjQ3LjAzLDIuMjIuMDgsMS45LjEyLDMuOTguMzksNi4xOC44LDIuMDkuNCwzLjksMS4xLDUuMzYsMi4wOC43LjQ4LDEuMTMsMSwxLjMxLDEuNi4yLjY2LjIxLDEuMzIuMDQsMi4wMi0uMTkuNzctLjUyLDEuNTUtLjk5LDIuMy0uNDguNzctMSwxLjQxLTEuNTgsMS45My0xLjUzLDEuNDMtMy4yNiwyLjU3LTUuMTUsMy4zOS0xLjk1Ljg1LTQuMDIsMS41OC02LjE1LDIuMTctNC43NywxLjQxLTkuNzIsMi40NC0xNC43MiwzLjA3LTUsLjYzLTEwLjA0Ljk2LTE1LjAyLDEtMS4zMy4wNS0yLjY1LjA3LTMuOTkuMDctMy4zMSwwLTYuNjktLjE1LTEwLjA1LS40NC00LjY0LS40LTkuMTItMS4zNi0xMy4zOC0yLjg1LS42Ny0uMi0xLjU5LS41Mi0yLjc4LS45Ny0xLjE0LS40My0yLjI0LS45NS0zLjI3LTEuNTYtLjk2LS41Ni0xLjczLTEuMjEtMi4zMS0xLjkzLS40LS41LS40Ni0uOTgtLjE5LTEuNjYuMjctLjguNzctMS40NiwxLjUzLTIuMDIuODUtLjYzLDEuODEtMS4xNiwyLjg3LTEuNTcsMS4xMS0uNDQsMi4yNi0uODEsMy40My0xLjEzLDEuMjItLjMzLDIuMzEtLjYzLDMuMjItLjg5LDEuNDItLjM0LDEuNTktMS4zNywxLjQ2LTEuOTQtLjEtLjQ1LS4zNi0uODktLjc2LTEuMzEtLjMxLS4zMS0uNjYtLjYtMS4wNy0uODctLjUzLS4zNS0uOTgtLjUxLTEuNC0uNTMtLjMyLDAtLjY0LS4wMS0uOTctLjAxLTEsMC0yLjA0LjA0LTMuMS4xMy0xLjQyLjEyLTIuODUuMzQtNC4yNC42OC0xLjQyLjM0LTIuNzguODQtNC4wNSwxLjQ4LTEuMzEuNjYtMi40NiwxLjUzLTMuNDIsMi42LTEuMDksMS4yNi0xLjY5LDIuNTgtMS43NywzLjkzLS4wOCwxLjMuMTgsMi41NS43OCwzLjcyLjU2LDEuMDksMS4zMiwyLjEyLDIuMjUsMy4wNy45LjkyLDEuODYsMS43MywyLjg2LDIuNDEsMi40NywxLjY5LDUuMTEsMy4wOCw3Ljg1LDQuMTIsMi42OCwxLjAzLDUuNSwxLjg4LDguMzksMi41MiwyLjg0LjYzLDUuNzYsMS4xMSw4LjY4LDEuNDEsMi44Ny4zLDUuNzkuNDksOC42My41NywyLjEzLjExLDQuMjcuMTYsNi40Mi4xNmgwYzQuMzEsMCw4LjcxLS4yMSwxMy4wOC0uNjMsNi41NS0uNjMsMTMuMDMtMS44NCwxOS4yNC0zLjYxLDEuMzMtLjM1LDQuOTItMS42Miw3LjkzLTMuMTcsMy4xNi0xLjYzLDUuNzUtMy41OCw2LjczLTQuNjUsMS45Mi0yLjA1LDMuMTItNC4zOSwzLjU1LTYuOTcuNDUtMi42OS0uMzMtNS4yNy0yLjMtNy42NC0uOTgtMS4yLTIuMTgtMi4yOC0zLjU4LTMuMloiLz4KICA8L2c+Cjwvc3ZnPg=="
  , nc = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAJVBiADASIAAhEBAxEB/8QAHQABAAEEAwEAAAAAAAAAAAAAAAECBwgJAwUGBP/EAF4QAAEDAgMEBQUKCgcEBwUJAAABAgMEBQYHEQgSITFBUWFxgRMUIjKRCRhCUlN1gpKh0hUjMzdWYnKUsbMWJDaissHRQ2OjwhcnNEZUleImc3SF4SU1RVdlZpOk8P/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDDIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/9k="
  , rc = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjMzMCAyNjUgMTcwIDcwIj4KICA8cGF0aCBmaWxsPSJ3aGl0ZSIgZD0iTTM4Ni45LDI3My4wNXY0OC4yN2gtMTEuMjRsLTIxLjMxLTI1LjcydjI1LjcyaC0xMy4zOHYtNDguMjdoMTEuMjRsMjEuMzEsMjUuNzJ2LTI1LjcyaDEzLjM4WiIvPgogIDxwYXRoIGZpbGw9IndoaXRlIiBkPSJNNDQ4LjcyLDI5Ny4xOWMwLDE0LjQ4LTExLjM4LDI1LjEtMjYuODIsMjUuMS00LjQxLDAtOC40OC0uOS0xMi4wNy0yLjQxbC00LjQ4LDYuMjhoLTguMDdsNi45LTkuNzJjLTUuNjYtNC40OC05LjEtMTEuMzEtOS4xLTE5LjI0LDAtMTQuNDgsMTEuMzgtMjUuMSwyNi44Mi0yNS4xLDQuNDEsMCw4LjQ4LjksMTIuMDcsMi40MWw0LjQ4LTYuMjdoOC4wN2wtNi44OSw5LjcyYzUuNjUsNC40OCw5LjEsMTEuMzEsOS4xLDE5LjI0Wk00MTEuNjIsMzA2LjAybDE1LjM4LTIxLjY1Yy0xLjU5LS42Mi0zLjMxLS45Ny01LjEtLjk3LTcuMzEsMC0xMy4wMyw1LjQ1LTEzLjAzLDEzLjc5LDAsMy41MiwxLjAzLDYuNDgsMi43Niw4LjgzWk00MzQuOTMsMjk3LjE5YzAtMy41Mi0xLjAzLTYuNDgtMi43Ni04LjgzbC0xNS4zOCwyMS42NWMxLjU5LjYyLDMuMzEuOTYsNS4xLjk2LDcuMzEsMCwxMy4wMy01LjQ1LDEzLjAzLTEzLjc5WiIvPgogIDxwYXRoIGZpbGw9IndoaXRlIiBkPSJNNDc4LDMwOC41aC03LjQ1djEyLjgzaC0xMy42NXYtNDguMjdoMjIuMDdjMTMuMTcsMCwyMS40NSw2LjgzLDIxLjQ1LDE3Ljg2LDAsNy4xLTMuNDUsMTIuMzQtOS40NSwxNS4yNGwxMC40MSwxNS4xN2gtMTQuNjJsLTguNzYtMTIuODNaTTQ3OC4xNCwyODMuODFoLTcuNTl2MTQuMTRoNy41OWM1LjY1LDAsOC40OC0yLjYyLDguNDgtNy4wM3MtMi44My03LjEtOC40OC03LjFaIi8+Cjwvc3ZnPg=="
  , t1 = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAcIBaoDASIAAhEBAxEB/8QAHQABAAEFAQEBAAAAAAAAAAAAAAYEBQcICQMCAf/EAGQQAAICAQIEAwMFCQkKCggCCwABAgMEBREGEiExBxNBIlFhCBQycYEVGCNCVpGU0dMJFzZSV3WVobMWJDNicoKlsbTBNzhDVHaSorLS8CU1U1V0hJPh8XODozREY9TCwyYnR//EABoBAQADAQEBAAAAAAAAAAAAAAACAwQFAQb/xAA5EQEAAgIABAIGCQMFAQADAAAAAQIDEQQSITFBUQUTImGh8AYycYGRscHR4RUW8RQjM0JSU0Njov/aAAwDAQACEQMRAD8A0yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//9k="
  , n1 = {
    México: "🇲🇽",
    "África do Sul": "🇿🇦",
    "Coreia do Sul": "🇰🇷",
    "Rep. Tcheca": "🇨🇿",
    Canadá: "🇨🇦",
    Bósnia: "🇧🇦",
    Catar: "🇶🇦",
    Suíça: "🇨🇭",
    Brasil: "🇧🇷",
    Marrocos: "🇲🇦",
    Haiti: "🇭🇹",
    Escócia: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    EUA: "🇺🇸",
    Paraguai: "🇵🇾",
    Austrália: "🇦🇺",
    Turquia: "🇹🇷",
    Alemanha: "🇩🇪",
    Curaçao: "🇨🇼",
    "Costa do Marfim": "🇨🇮",
    Equador: "🇪🇨",
    Holanda: "🇳🇱",
    Japão: "🇯🇵",
    Suécia: "🇸🇪",
    Tunísia: "🇹🇳",
    Bélgica: "🇧🇪",
    Egito: "🇪🇬",
    Irã: "🇮🇷",
    "Nova Zelândia": "🇳🇿",
    Espanha: "🇪🇸",
    "Cabo Verde": "🇨🇻",
    "Arábia Saudita": "🇸🇦",
    Uruguai: "🇺🇾",
    França: "🇫🇷",
    Senegal: "🇸🇳",
    Iraque: "🇮🇶",
    Noruega: "🇳🇴",
    Argentina: "🇦🇷",
    Argélia: "🇩🇿",
    Áustria: "🇦🇹",
    Jordânia: "🇯🇴",
    Portugal: "🇵🇹",
    "RD Congo": "🇨🇩",
    Uzbequistão: "🇺🇿",
    Colômbia: "🇨🇴",
    Inglaterra: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    Croácia: "🇭🇷",
    Gana: "🇬🇭",
    Panamá: "🇵🇦"
}
  , si = Object.keys(n1)
  , r1 = {
    A: ["México", "África do Sul", "Coreia do Sul", "Rep. Tcheca"],
    B: ["Canadá", "Bósnia", "Catar", "Suíça"],
    C: ["Brasil", "Marrocos", "Haiti", "Escócia"],
    D: ["EUA", "Paraguai", "Austrália", "Turquia"],
    E: ["Alemanha", "Curaçao", "Costa do Marfim", "Equador"],
    F: ["Holanda", "Japão", "Suécia", "Tunísia"],
    G: ["Bélgica", "Egito", "Irã", "Nova Zelândia"],
    H: ["Espanha", "Cabo Verde", "Arábia Saudita", "Uruguai"],
    I: ["França", "Senegal", "Iraque", "Noruega"],
    J: ["Argentina", "Argélia", "Áustria", "Jordânia"],
    K: ["Portugal", "RD Congo", "Uzbequistão", "Colômbia"],
    L: ["Inglaterra", "Croácia", "Gana", "Panamá"]
}
  , Tn = [{
    id: 1,
    casa: "México",
    fora: "África do Sul",
    grupo: "A",
    data: "11/06",
    hora: "16h",
    rodada: 1
}, {
    id: 2,
    casa: "Coreia do Sul",
    fora: "Rep. Tcheca",
    grupo: "A",
    data: "11/06",
    hora: "23h",
    rodada: 1
}, {
    id: 3,
    casa: "Canadá",
    fora: "Bósnia",
    grupo: "B",
    data: "12/06",
    hora: "16h",
    rodada: 1
}, {
    id: 4,
    casa: "EUA",
    fora: "Paraguai",
    grupo: "D",
    data: "12/06",
    hora: "22h",
    rodada: 1
}, {
    id: 5,
    casa: "Catar",
    fora: "Suíça",
    grupo: "B",
    data: "13/06",
    hora: "16h",
    rodada: 1
}, {
    id: 6,
    casa: "Brasil",
    fora: "Marrocos",
    grupo: "C",
    data: "13/06",
    hora: "19h",
    rodada: 1,
    brasil: !0
}, {
    id: 7,
    casa: "Haiti",
    fora: "Escócia",
    grupo: "C",
    data: "13/06",
    hora: "22h",
    rodada: 1
}, {
    id: 8,
    casa: "Austrália",
    fora: "Turquia",
    grupo: "D",
    data: "14/06",
    hora: "01h",
    rodada: 1
}, {
    id: 9,
    casa: "Alemanha",
    fora: "Curaçao",
    grupo: "E",
    data: "14/06",
    hora: "14h",
    rodada: 1
}, {
    id: 10,
    casa: "Holanda",
    fora: "Japão",
    grupo: "F",
    data: "14/06",
    hora: "17h",
    rodada: 1
}, {
    id: 11,
    casa: "Costa do Marfim",
    fora: "Equador",
    grupo: "E",
    data: "14/06",
    hora: "20h",
    rodada: 1
}, {
    id: 12,
    casa: "Suécia",
    fora: "Tunísia",
    grupo: "F",
    data: "14/06",
    hora: "22h",
    rodada: 1
}, {
    id: 13,
    casa: "Espanha",
    fora: "Cabo Verde",
    grupo: "H",
    data: "15/06",
    hora: "13h",
    rodada: 1
}, {
    id: 14,
    casa: "Bélgica",
    fora: "Egito",
    grupo: "G",
    data: "15/06",
    hora: "16h",
    rodada: 1
}, {
    id: 15,
    casa: "Arábia Saudita",
    fora: "Uruguai",
    grupo: "H",
    data: "15/06",
    hora: "19h",
    rodada: 1
}, {
    id: 16,
    casa: "Irã",
    fora: "Nova Zelândia",
    grupo: "G",
    data: "15/06",
    hora: "22h",
    rodada: 1
}, {
    id: 17,
    casa: "França",
    fora: "Senegal",
    grupo: "I",
    data: "16/06",
    hora: "16h",
    rodada: 1
}, {
    id: 18,
    casa: "Iraque",
    fora: "Noruega",
    grupo: "I",
    data: "16/06",
    hora: "19h",
    rodada: 1
}, {
    id: 19,
    casa: "Argentina",
    fora: "Argélia",
    grupo: "J",
    data: "16/06",
    hora: "22h",
    rodada: 1
}, {
    id: 20,
    casa: "Áustria",
    fora: "Jordânia",
    grupo: "J",
    data: "17/06",
    hora: "01h",
    rodada: 1
}, {
    id: 21,
    casa: "Portugal",
    fora: "RD Congo",
    grupo: "K",
    data: "17/06",
    hora: "14h",
    rodada: 1
}, {
    id: 22,
    casa: "Inglaterra",
    fora: "Croácia",
    grupo: "L",
    data: "17/06",
    hora: "17h",
    rodada: 1
}, {
    id: 23,
    casa: "Gana",
    fora: "Panamá",
    grupo: "L",
    data: "17/06",
    hora: "20h",
    rodada: 1
}, {
    id: 24,
    casa: "Uzbequistão",
    fora: "Colômbia",
    grupo: "K",
    data: "17/06",
    hora: "21h",
    rodada: 1
}, {
    id: 25,
    casa: "Rep. Tcheca",
    fora: "África do Sul",
    grupo: "A",
    data: "18/06",
    hora: "13h",
    rodada: 2
}, {
    id: 26,
    casa: "Suíça",
    fora: "Bósnia",
    grupo: "B",
    data: "18/06",
    hora: "16h",
    rodada: 2
}, {
    id: 27,
    casa: "Canadá",
    fora: "Catar",
    grupo: "B",
    data: "18/06",
    hora: "19h",
    rodada: 2
}, {
    id: 28,
    casa: "México",
    fora: "Coreia do Sul",
    grupo: "A",
    data: "18/06",
    hora: "22h",
    rodada: 2
}, {
    id: 29,
    casa: "EUA",
    fora: "Austrália",
    grupo: "D",
    data: "19/06",
    hora: "16h",
    rodada: 2
}, {
    id: 30,
    casa: "Escócia",
    fora: "Marrocos",
    grupo: "C",
    data: "19/06",
    hora: "19h",
    rodada: 2
}, {
    id: 31,
    casa: "Brasil",
    fora: "Haiti",
    grupo: "C",
    data: "19/06",
    hora: "21h30",
    rodada: 2,
    brasil: !0
}, {
    id: 32,
    casa: "Turquia",
    fora: "Paraguai",
    grupo: "D",
    data: "20/06",
    hora: "00h",
    rodada: 2
}, {
    id: 33,
    casa: "Holanda",
    fora: "Suécia",
    grupo: "F",
    data: "20/06",
    hora: "14h",
    rodada: 2
}, {
    id: 34,
    casa: "Alemanha",
    fora: "Costa do Marfim",
    grupo: "E",
    data: "20/06",
    hora: "17h",
    rodada: 2
}, {
    id: 35,
    casa: "Equador",
    fora: "Curaçao",
    grupo: "E",
    data: "20/06",
    hora: "21h",
    rodada: 2
}, {
    id: 36,
    casa: "Tunísia",
    fora: "Japão",
    grupo: "F",
    data: "20/06",
    hora: "23h",
    rodada: 2
}, {
    id: 37,
    casa: "Espanha",
    fora: "Arábia Saudita",
    grupo: "H",
    data: "21/06",
    hora: "13h",
    rodada: 2
}, {
    id: 38,
    casa: "Bélgica",
    fora: "Irã",
    grupo: "G",
    data: "21/06",
    hora: "16h",
    rodada: 2
}, {
    id: 39,
    casa: "Uruguai",
    fora: "Cabo Verde",
    grupo: "H",
    data: "21/06",
    hora: "19h",
    rodada: 2
}, {
    id: 40,
    casa: "Nova Zelândia",
    fora: "Egito",
    grupo: "G",
    data: "21/06",
    hora: "22h",
    rodada: 2
}, {
    id: 41,
    casa: "Argentina",
    fora: "Áustria",
    grupo: "J",
    data: "22/06",
    hora: "14h",
    rodada: 2
}, {
    id: 42,
    casa: "França",
    fora: "Iraque",
    grupo: "I",
    data: "22/06",
    hora: "18h",
    rodada: 2
}, {
    id: 43,
    casa: "Noruega",
    fora: "Senegal",
    grupo: "I",
    data: "22/06",
    hora: "21h",
    rodada: 2
}, {
    id: 44,
    casa: "Jordânia",
    fora: "Argélia",
    grupo: "J",
    data: "23/06",
    hora: "00h",
    rodada: 2
}, {
    id: 45,
    casa: "Portugal",
    fora: "Uzbequistão",
    grupo: "K",
    data: "23/06",
    hora: "14h",
    rodada: 2
}, {
    id: 46,
    casa: "Inglaterra",
    fora: "Gana",
    grupo: "L",
    data: "23/06",
    hora: "17h",
    rodada: 2
}, {
    id: 47,
    casa: "Panamá",
    fora: "Croácia",
    grupo: "L",
    data: "23/06",
    hora: "20h",
    rodada: 2
}, {
    id: 48,
    casa: "Colômbia",
    fora: "RD Congo",
    grupo: "K",
    data: "23/06",
    hora: "23h",
    rodada: 2
}, {
    id: 49,
    casa: "Suíça",
    fora: "Canadá",
    grupo: "B",
    data: "24/06",
    hora: "16h",
    rodada: 3
}, {
    id: 50,
    casa: "Bósnia",
    fora: "Catar",
    grupo: "B",
    data: "24/06",
    hora: "16h",
    rodada: 3
}, {
    id: 51,
    casa: "Escócia",
    fora: "Brasil",
    grupo: "C",
    data: "24/06",
    hora: "19h",
    rodada: 3,
    brasil: !0
}, {
    id: 52,
    casa: "Marrocos",
    fora: "Haiti",
    grupo: "C",
    data: "24/06",
    hora: "19h",
    rodada: 3
}, {
    id: 53,
    casa: "Rep. Tcheca",
    fora: "México",
    grupo: "A",
    data: "24/06",
    hora: "22h",
    rodada: 3
}, {
    id: 54,
    casa: "África do Sul",
    fora: "Coreia do Sul",
    grupo: "A",
    data: "24/06",
    hora: "22h",
    rodada: 3
}, {
    id: 55,
    casa: "Equador",
    fora: "Alemanha",
    grupo: "E",
    data: "25/06",
    hora: "17h",
    rodada: 3
}, {
    id: 56,
    casa: "Curaçao",
    fora: "Costa do Marfim",
    grupo: "E",
    data: "25/06",
    hora: "17h",
    rodada: 3
}, {
    id: 57,
    casa: "Japão",
    fora: "Suécia",
    grupo: "F",
    data: "25/06",
    hora: "20h",
    rodada: 3
}, {
    id: 58,
    casa: "Tunísia",
    fora: "Holanda",
    grupo: "F",
    data: "25/06",
    hora: "20h",
    rodada: 3
}, {
    id: 59,
    casa: "Turquia",
    fora: "EUA",
    grupo: "D",
    data: "25/06",
    hora: "23h",
    rodada: 3
}, {
    id: 60,
    casa: "Paraguai",
    fora: "Austrália",
    grupo: "D",
    data: "25/06",
    hora: "23h",
    rodada: 3
}, {
    id: 61,
    casa: "Noruega",
    fora: "França",
    grupo: "I",
    data: "26/06",
    hora: "16h",
    rodada: 3
}, {
    id: 62,
    casa: "Senegal",
    fora: "Iraque",
    grupo: "I",
    data: "26/06",
    hora: "16h",
    rodada: 3
}, {
    id: 63,
    casa: "Cabo Verde",
    fora: "Arábia Saudita",
    grupo: "H",
    data: "26/06",
    hora: "21h",
    rodada: 3
}, {
    id: 64,
    casa: "Uruguai",
    fora: "Espanha",
    grupo: "H",
    data: "26/06",
    hora: "21h",
    rodada: 3
}, {
    id: 65,
    casa: "Egito",
    fora: "Irã",
    grupo: "G",
    data: "27/06",
    hora: "00h",
    rodada: 3
}, {
    id: 66,
    casa: "Nova Zelândia",
    fora: "Bélgica",
    grupo: "G",
    data: "27/06",
    hora: "00h",
    rodada: 3
}, {
    id: 67,
    casa: "Panamá",
    fora: "Inglaterra",
    grupo: "L",
    data: "27/06",
    hora: "18h",
    rodada: 3
}, {
    id: 68,
    casa: "Croácia",
    fora: "Gana",
    grupo: "L",
    data: "27/06",
    hora: "18h",
    rodada: 3
}, {
    id: 69,
    casa: "Colômbia",
    fora: "Portugal",
    grupo: "K",
    data: "27/06",
    hora: "20h30",
    rodada: 3
}, {
    id: 70,
    casa: "RD Congo",
    fora: "Uzbequistão",
    grupo: "K",
    data: "27/06",
    hora: "20h30",
    rodada: 3
}, {
    id: 71,
    casa: "Argélia",
    fora: "Áustria",
    grupo: "J",
    data: "27/06",
    hora: "23h",
    rodada: 3
}, {
    id: 72,
    casa: "Jordânia",
    fora: "Argentina",
    grupo: "J",
    data: "27/06",
    hora: "23h",
    rodada: 3
}]
  , ra = [{
    id: "p01",
    nome: "Participante 01",
    cpf: ""
}, {
    id: "p02",
    nome: "Participante 02",
    cpf: ""
}, {
    id: "p03",
    nome: "Participante 03",
    cpf: ""
}, {
    id: "p04",
    nome: "Participante 04",
    cpf: ""
}, {
    id: "p05",
    nome: "Participante 05",
    cpf: ""
}, {
    id: "p06",
    nome: "Participante 06",
    cpf: ""
}, {
    id: "p07",
    nome: "Participante 07",
    cpf: ""
}, {
    id: "p08",
    nome: "Participante 08",
    cpf: ""
}, {
    id: "p09",
    nome: "Participante 09",
    cpf: ""
}, {
    id: "p10",
    nome: "Participante 10",
    cpf: ""
}, {
    id: "p11",
    nome: "Participante 11",
    cpf: ""
}, {
    id: "p12",
    nome: "Participante 12",
    cpf: ""
}, {
    id: "p13",
    nome: "Participante 13",
    cpf: ""
}, {
    id: "p14",
    nome: "Participante 14",
    cpf: ""
}, {
    id: "p15",
    nome: "Participante 15",
    cpf: ""
}, {
    id: "p16",
    nome: "Participante 16",
    cpf: ""
}, {
    id: "p17",
    nome: "Participante 17",
    cpf: ""
}, {
    id: "p18",
    nome: "Participante 18",
    cpf: ""
}, {
    id: "p19",
    nome: "Participante 19",
    cpf: ""
}, {
    id: "p20",
    nome: "Participante 20",
    cpf: ""
}, {
    id: "p21",
    nome: "Participante 21",
    cpf: ""
}, {
    id: "p22",
    nome: "Participante 22",
    cpf: ""
}, {
    id: "p23",
    nome: "Participante 23",
    cpf: ""
}, {
    id: "p24",
    nome: "Participante 24",
    cpf: ""
}, {
    id: "p25",
    nome: "Participante 25",
    cpf: ""
}, {
    id: "p26",
    nome: "Participante 26",
    cpf: ""
}, {
    id: "p27",
    nome: "Participante 27",
    cpf: ""
}, {
    id: "p28",
    nome: "Participante 28",
    cpf: ""
}, {
    id: "p29",
    nome: "Participante 29",
    cpf: ""
}, {
    id: "p30",
    nome: "Participante 30",
    cpf: ""
}, {
    id: "p31",
    nome: "Participante 31",
    cpf: ""
}, {
    id: "p32",
    nome: "Participante 32",
    cpf: ""
}, {
    id: "p33",
    nome: "Participante 33",
    cpf: ""
}, {
    id: "p34",
    nome: "Participante 34",
    cpf: ""
}, {
    id: "p35",
    nome: "Participante 35",
    cpf: ""
}, {
    id: "p36",
    nome: "Participante 36",
    cpf: ""
}, {
    id: "p37",
    nome: "Participante 37",
    cpf: ""
}, {
    id: "p38",
    nome: "Participante 38",
    cpf: ""
}, {
    id: "p39",
    nome: "Participante 39",
    cpf: ""
}, {
    id: "p40",
    nome: "Participante 40",
    cpf: ""
}, {
    id: "p41",
    nome: "Participante 41",
    cpf: ""
}, {
    id: "p42",
    nome: "Participante 42",
    cpf: ""
}, {
    id: "p43",
    nome: "Participante 43",
    cpf: ""
}, {
    id: "p44",
    nome: "Participante 44",
    cpf: ""
}, {
    id: "p45",
    nome: "Participante 45",
    cpf: ""
}, {
    id: "p46",
    nome: "Participante 46",
    cpf: ""
}, {
    id: "p47",
    nome: "Participante 47",
    cpf: ""
}, {
    id: "p48",
    nome: "Participante 48",
    cpf: ""
}, {
    id: "p49",
    nome: "Participante 49",
    cpf: ""
}, {
    id: "p50",
    nome: "Participante 50",
    cpf: ""
}, {
    id: "p51",
    nome: "Participante 51",
    cpf: ""
}, {
    id: "p52",
    nome: "Participante 52",
    cpf: ""
}, {
    id: "p53",
    nome: "Participante 53",
    cpf: ""
}, {
    id: "p54",
    nome: "Participante 54",
    cpf: ""
}, {
    id: "p55",
    nome: "Participante 55",
    cpf: ""
}, {
    id: "p56",
    nome: "Participante 56",
    cpf: ""
}, {
    id: "p57",
    nome: "Participante 57",
    cpf: ""
}, {
    id: "p58",
    nome: "Participante 58",
    cpf: ""
}, {
    id: "p59",
    nome: "Participante 59",
    cpf: ""
}, {
    id: "p60",
    nome: "Participante 60",
    cpf: ""
}, {
    id: "p61",
    nome: "Participante 61",
    cpf: ""
}, {
    id: "p62",
    nome: "Participante 62",
    cpf: ""
}, {
    id: "p63",
    nome: "Participante 63",
    cpf: ""
}, {
    id: "p64",
    nome: "Participante 64",
    cpf: ""
}, {
    id: "p65",
    nome: "Participante 65",
    cpf: ""
}, {
    id: "p66",
    nome: "Participante 76",
    cpf: ""
}, {
    id: "p67",
    nome: "Participante 66",
    cpf: ""
}, {
    id: "p68",
    nome: "Participante 67",
    cpf: ""
}, {
    id: "p69",
    nome: "Participante 68",
    cpf: ""
}, {
    id: "p70",
    nome: "Participante 69",
    cpf: ""
}, {
    id: "p71",
    nome: "Participante 70",
    cpf: ""
}, {
    id: "p72",
    nome: "Participante 71",
    cpf: ""
}, {
    id: "p73",
    nome: "Participante 72",
    cpf: ""
}, {
    id: "p74",
    nome: "Participante 73",
    cpf: ""
}, {
    id: "p75",
    nome: "Participante 74",
    cpf: ""
}, {
    id: "p76",
    nome: "Participante 75",
    cpf: ""
}, {
    id: "p77",
    nome: "Participante 77",
    cpf: ""
}]
  , cl = 10
  , fl = 5
  , $a = 15
  , Ao = 8
  , Mr = A => !!A && (Number(A.id) > 72 || !!A.fase && A.fase !== "grupos")
  , l1 = 2026
  , gt = [{
    id: "grupos",
    nome: "Fase de Grupos",
    periodo: "11 a 28 de junho",
    fecha: "2026-06-10T23:59:59-03:00"
}, {
    id: "r32",
    nome: "16-avos de final",
    periodo: "28/06 a 04/07",
    fecha: "2026-06-27T23:59:59-03:00"
}, {
    id: "oitavas",
    nome: "Oitavas de final",
    periodo: "04 a 07 de julho",
    fecha: "2026-07-03T23:59:59-03:00"
}, {
    id: "quartas",
    nome: "Quartas de final",
    periodo: "09 a 12 de julho",
    fecha: "2026-07-08T23:59:59-03:00"
}, {
    id: "semi",
    nome: "Semifinais",
    periodo: "14 e 15 de julho",
    fecha: "2026-07-13T23:59:59-03:00"
}, {
    id: "terceiro",
    nome: "Disputa de 3º lugar",
    periodo: "18 de julho",
    fecha: "2026-07-17T23:59:59-03:00"
}, {
    id: "final",
    nome: "Final",
    periodo: "19 de julho",
    fecha: "2026-07-18T23:59:59-03:00"
}]
  , eo = Object.fromEntries(gt.map(A => [A.id, A]))
  , i1 = new Date(eo.grupos.fecha)
  , lc = "2026-07-08T00:00:00-03:00"
  , ic = "2026-07-08T23:59:59-03:00"
  , a1 = 1e3
  , o1 = (A, e="auto") => {
    if (e === "aberta")
        return "aberta";
    if (e === "fechada")
        return "encerrada";
    const t = A.getTime();
    return t < new Date(lc).getTime() ? "bloqueada" : t > new Date(ic).getTime() ? "encerrada" : "aberta"
}
  , u1 = (A, e) => {
    const t = eo[A];
    return !!t && e.getTime() < new Date(t.fecha).getTime()
}
  , Zu = (A, e, t={}) => {
    const n = t[A];
    return n === "aberta" ? !0 : n === "fechada" ? !1 : u1(A, e)
}
  , s1 = 130;
function ac(A) {
    if (!(A != null && A.data) || !(A != null && A.hora))
        return null;
    const [e,t] = A.data.split("/")
      , [n,r] = A.hora.replace("h", " ").trim().split(" ")
      , l = String(n || "0").padStart(2, "0")
      , a = String(r || "0").padStart(2, "0");
    return new Date(`${l1}-${t}-${e}T${l}:${a}:00-03:00`)
}
function d1(A, e, t) {
    const n = ac(A);
    if (!n)
        return "agendado";
    const r = new Date(n.getTime() + s1 * 6e4);
    return t ? "encerrado" : e < n ? "agendado" : e >= n && e < r ? "ao_vivo" : "aguardando_resultado"
}
function Rr(A, e) {
    if (!e || e.casa === null || e.fora === null || !A || A.casa === void 0 || A.fora === void 0)
        return null;
    if (A.casa === e.casa && A.fora === e.fora)
        return "exato";
    const t = A.casa > A.fora ? "C" : A.casa < A.fora ? "F" : "E"
      , n = e.casa > e.fora ? "C" : e.casa < e.fora ? "F" : "E";
    return t === n ? "venc" : "errou"
}
function Ln(A, e, t=!1) {
    const n = Rr(A, e);
    return n === null ? null : n === "exato" ? t ? $a : cl : n === "venc" ? t ? Ao : fl : 0
}
function hn(A) {
    return (A || "").replace(/\D/g, "")
}
function c1(A) {
    const e = hn(A).slice(0, 14);
    return e.length <= 3 ? e : e.length <= 6 ? e.slice(0, 3) + "." + e.slice(3) : e.length <= 9 ? e.slice(0, 3) + "." + e.slice(3, 6) + "." + e.slice(6) : e.length <= 11 ? e.slice(0, 3) + "." + e.slice(3, 6) + "." + e.slice(6, 9) + "-" + e.slice(9) : e.length <= 12 ? e.slice(0, 2) + "." + e.slice(2, 5) + "." + e.slice(5, 8) + "/" + e.slice(8) : e.slice(0, 2) + "." + e.slice(2, 5) + "." + e.slice(5, 8) + "/" + e.slice(8, 12) + "-" + e.slice(12)
}
function br(A) {
    return c1(A)
}
const z = {
    card: (A={}) => ({
        background: o.card,
        border: `1px solid ${o.border}`,
        borderRadius: 14,
        padding: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
        ...A
    }),
    btn: (A="primary", e={}) => ({
        border: "none",
        borderRadius: 10,
        cursor: "pointer",
        fontWeight: 700,
        letterSpacing: .5,
        transition: "transform .12s ease, opacity .15s ease",
        ...A === "primary" ? {
            background: o.primary,
            color: o.onPrimary,
            padding: "12px 20px",
            fontSize: 14
        } : {},
        ...A === "ghost" ? {
            background: "transparent",
            border: `1px solid ${o.border}`,
            color: o.textMid,
            padding: "10px 18px",
            fontSize: 13
        } : {},
        ...A === "dim" ? {
            background: o.surface,
            border: `1px solid ${o.border}`,
            color: o.textMid,
            padding: "8px 14px",
            fontSize: 12
        } : {},
        ...e
    }),
    label: {
        fontSize: 10,
        letterSpacing: 2,
        color: o.textDim,
        fontWeight: 700,
        textTransform: "uppercase",
        display: "block",
        marginBottom: 8
    },
    input: (A={}) => ({
        width: "100%",
        boxSizing: "border-box",
        background: o.card,
        border: `1px solid ${o.border}`,
        borderRadius: 10,
        padding: "12px 16px",
        color: o.text,
        fontSize: 15,
        outline: "none",
        ...A
    })
}
  , f1 = {
    home: "M3 11.5 12 4l9 7.5M5 10v10h14V10",
    ball: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13 4.5 3.3-1.7 5.2H9.2L7.5 11.3 12 8Z",
    ranking: "M8 21V9H4v12M14 21V3h-4v18M20 21v-8h-4v8M3 21h18",
    target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    gift: "M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7S11 3 8.5 3 6 5.5 8 7M12 7s1-4 3.5-4S18 5.5 16 7",
    admin: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2.2-1.3L14.3 2H9.7l-.4 2.6a7.3 7.3 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 2.2 1.3l.4 2.6h4.6l.4-2.6a7.3 7.3 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.06-.43.1-.86.1-1.3Z",
    bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
    trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3",
    star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9L12 3Z",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
    chart: "M3 3v18h18M7 15l4-4 3 3 5-6",
    calendar: "M7 3v4M17 3v4M3 9h18M5 5h14v16H5z",
    check: "M20 6 9 17l-5-5",
    chevron: "M9 6l6 6-6 6"
};
function qe({name: A, size: e=22, color: t="currentColor", stroke: n=2, fill: r="none", style: l}) {
    const a = f1[A];
    return a ? i.jsx("svg", {
        width: e,
        height: e,
        viewBox: "0 0 24 24",
        fill: r,
        stroke: t,
        strokeWidth: n,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: l,
        "aria-hidden": "true",
        children: i.jsx("path", {
            d: a
        })
    }) : null
}
const p1 = {
    inicio: "home",
    jogos: "ball",
    ranking: "ranking",
    premiacao: "gift",
    regras: "list",
    admin: "admin"
}
  , y1 = "21171687000106"
  , Ru = ["332", "356", "333"]
  , v1 = {
    México: "mx",
    "África do Sul": "za",
    "Coreia do Sul": "kr",
    "Rep. Tcheca": "cz",
    Canadá: "ca",
    Bósnia: "ba",
    Catar: "qa",
    Suíça: "ch",
    Brasil: "br",
    Marrocos: "ma",
    Haiti: "ht",
    Escócia: "gb-sct",
    EUA: "us",
    Paraguai: "py",
    Austrália: "au",
    Turquia: "tr",
    Alemanha: "de",
    Curaçao: "cw",
    "Costa do Marfim": "ci",
    Equador: "ec",
    Holanda: "nl",
    Japão: "jp",
    Suécia: "se",
    Tunísia: "tn",
    Bélgica: "be",
    Egito: "eg",
    Irã: "ir",
    "Nova Zelândia": "nz",
    Espanha: "es",
    "Cabo Verde": "cv",
    "Arábia Saudita": "sa",
    Uruguai: "uy",
    França: "fr",
    Senegal: "sn",
    Iraque: "iq",
    Noruega: "no",
    Argentina: "ar",
    Argélia: "dz",
    Áustria: "at",
    Jordânia: "jo",
    Portugal: "pt",
    "RD Congo": "cd",
    Uzbequistão: "uz",
    Colômbia: "co",
    Inglaterra: "gb-eng",
    Croácia: "hr",
    Gana: "gh",
    Panamá: "pa"
};
function rA({t: A, h: e=16, style: t}) {
    const n = v1[A];
    return n ? i.jsx("img", {
        src: `https://flagcdn.com/h40/${n}.png`,
        alt: "",
        "aria-hidden": "true",
        style: {
            height: e,
            width: "auto",
            borderRadius: 3,
            objectFit: "cover",
            verticalAlign: "middle",
            boxShadow: "0 0 0 1px rgba(0,0,0,.2)",
            display: "inline-block",
            ...t
        },
        loading: "lazy"
    }) : i.jsx("span", {
        style: t
    })
}
function m1({onLogin: A, participantes: e}) {
    const [t,n] = X.useState("")
      , [r,l] = X.useState("")
      , [a,u] = X.useState(!1)
      , [s,y] = X.useState("")
      , N = () => {
        const m = t.replace(/\D/g, "");
        if (m === y1) {
            Ru.length ? (u(!0),
            l("")) : A({
                id: "admin",
                nome: "Administrador",
                admin: !0
            });
            return
        }
        const h = (e || ra).find(T => T.cpf && T.cpf.replace(/\D/g, "") === m);
        if (h) {
            A(h);
            return
        }
        l("CPF não encontrado. Fale com o RH.")
    }
      , L = () => {
        Ru.includes(s.replace(/\D/g, "").slice(0, 3)) ? A({
            id: "admin",
            nome: "Administrador",
            admin: !0
        }) : l("Código inválido.")
    }
    ;
    return i.jsxs("div", {
        style: {
            minHeight: "100dvh",
            background: o.bg,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom))"
        },
        children: [i.jsx("style", {
            children: `@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&family=Antonio:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;500;600;700&display=swap');*{font-family:'Barlow',sans-serif;}button:focus-visible,input:focus-visible{outline:2px solid ${o.accent};outline-offset:2px;box-shadow:0 0 0 3px ${H(o.accent, 35)};}`
        }), i.jsxs("div", {
            style: {
                textAlign: "center",
                marginBottom: 40
            },
            children: [i.jsxs("div", {
                style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 24,
                    marginBottom: 24,
                    flexWrap: "wrap"
                },
                children: [i.jsx("img", {
                    src: tc,
                    alt: "Usee Brasil",
                    style: {
                        height: 54,
                        objectFit: "contain",
                        filter: "brightness(0) invert(1)"
                    }
                }), i.jsx("div", {
                    style: {
                        width: 1,
                        height: 30,
                        background: o.border
                    }
                }), i.jsx("img", {
                    src: nc,
                    alt: "Weesu",
                    style: {
                        height: 54,
                        objectFit: "contain",
                        mixBlendMode: "screen"
                    }
                }), i.jsx("div", {
                    style: {
                        width: 1,
                        height: 30,
                        background: o.border
                    }
                }), i.jsx("img", {
                    src: rc,
                    alt: "NOR",
                    style: {
                        height: 38,
                        objectFit: "contain",
                        filter: "brightness(0) invert(1)"
                    }
                })]
            }), i.jsx("img", {
                src: t1,
                alt: "Copa 2026",
                style: {
                    height: 160,
                    objectFit: "contain",
                    display: "block",
                    margin: "0 auto 12px",
                    mixBlendMode: "screen"
                }
            }), i.jsx("div", {
                style: {
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 38,
                    fontWeight: 900,
                    color: o.text,
                    lineHeight: 1,
                    letterSpacing: 1
                },
                children: "BOLÃO COPA DO"
            }), i.jsx("div", {
                style: {
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 38,
                    fontWeight: 900,
                    color: o.primary,
                    lineHeight: 1,
                    letterSpacing: 1
                },
                children: "MUNDO 2026"
            }), i.jsx("div", {
                style: {
                    width: 140,
                    height: 5,
                    borderRadius: 3,
                    background: $d,
                    margin: "14px auto 0"
                }
            })]
        }), i.jsx("div", {
            style: {
                background: o.card,
                border: "1px solid " + o.border,
                borderRadius: 14,
                padding: 28,
                width: "100%",
                maxWidth: 360
            },
            children: a ? i.jsxs(i.Fragment, {
                children: [i.jsxs("div", {
                    style: {
                        textAlign: "center",
                        marginBottom: 20
                    },
                    children: [i.jsx("div", {
                        style: {
                            fontSize: 13,
                            color: o.text,
                            fontWeight: 700
                        },
                        children: "Acesso de administrador"
                    }), i.jsx("div", {
                        style: {
                            fontSize: 12,
                            color: o.textMid,
                            marginTop: 4
                        },
                        children: "Informe os 3 primeiros dígitos do seu CPF"
                    })]
                }), i.jsx("input", {
                    type: "text",
                    inputMode: "numeric",
                    placeholder: "• • •",
                    value: s,
                    autoFocus: !0,
                    maxLength: 3,
                    onChange: m => {
                        y(m.target.value.replace(/\D/g, "").slice(0, 3)),
                        l("")
                    }
                    ,
                    onKeyDown: m => {
                        m.key === "Enter" && L()
                    }
                    ,
                    style: {
                        width: "100%",
                        boxSizing: "border-box",
                        background: o.surface,
                        border: "1px solid " + o.border,
                        borderRadius: 10,
                        padding: "14px 16px",
                        color: o.text,
                        fontSize: 24,
                        textAlign: "center",
                        letterSpacing: 8,
                        marginBottom: 12,
                        outline: "none"
                    }
                }), r && i.jsx("div", {
                    style: {
                        background: H(o.error, 12),
                        border: `1px solid ${H(o.error, 40)}`,
                        borderRadius: 8,
                        padding: "10px",
                        fontSize: 13,
                        color: o.error,
                        marginBottom: 12,
                        textAlign: "center"
                    },
                    children: r
                }), i.jsx("button", {
                    onClick: L,
                    style: {
                        width: "100%",
                        background: o.primary,
                        border: "none",
                        borderRadius: 10,
                        padding: "14px",
                        color: o.onPrimary,
                        fontSize: 16,
                        fontWeight: 700,
                        cursor: "pointer"
                    },
                    children: "ACESSAR"
                }), i.jsx("button", {
                    onClick: () => {
                        u(!1),
                        y(""),
                        l("")
                    }
                    ,
                    style: {
                        width: "100%",
                        background: "transparent",
                        border: `1px solid ${o.border}`,
                        borderRadius: 10,
                        padding: "11px",
                        color: o.textMid,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        marginTop: 10
                    },
                    children: "← Voltar"
                })]
            }) : i.jsxs(i.Fragment, {
                children: [i.jsx("div", {
                    style: {
                        textAlign: "center",
                        marginBottom: 20
                    },
                    children: i.jsx("div", {
                        style: {
                            fontSize: 13,
                            color: o.textMid
                        },
                        children: "Digite seu CPF para entrar"
                    })
                }), i.jsx("input", {
                    type: "text",
                    inputMode: "numeric",
                    placeholder: "Somente números",
                    value: t,
                    onChange: m => {
                        n(m.target.value),
                        l("")
                    }
                    ,
                    onKeyDown: m => {
                        m.key === "Enter" && N()
                    }
                    ,
                    style: {
                        width: "100%",
                        boxSizing: "border-box",
                        background: o.surface,
                        border: "1px solid " + o.border,
                        borderRadius: 10,
                        padding: "14px 16px",
                        color: o.text,
                        fontSize: 18,
                        textAlign: "center",
                        letterSpacing: 2,
                        marginBottom: 12,
                        outline: "none"
                    }
                }), r && i.jsx("div", {
                    style: {
                        background: H(o.primary, 10),
                        border: `1px solid ${H(o.primary, 30)}`,
                        borderRadius: 8,
                        padding: "10px",
                        fontSize: 13,
                        color: o.primary,
                        marginBottom: 12,
                        textAlign: "center"
                    },
                    children: r
                }), i.jsx("button", {
                    onClick: N,
                    style: {
                        width: "100%",
                        background: o.primary,
                        border: "none",
                        borderRadius: 10,
                        padding: "14px",
                        color: o.onPrimary,
                        fontSize: 16,
                        fontWeight: 700,
                        cursor: "pointer"
                    },
                    children: "ENTRAR"
                }), i.jsx("div", {
                    style: {
                        textAlign: "center",
                        marginTop: 14,
                        fontSize: 11,
                        color: o.textDim
                    },
                    children: "Seu CPF é sua senha · Problemas: fale com o RH"
                })]
            })
        })]
    })
}
function L1({user: A, palpites: e, onSalvar: t, onFechar: n, travado: r, jogos: l=Tn}) {
    const [a,u] = X.useState({
        ...e == null ? void 0 : e.placares
    })
      , [s,y] = X.useState("Brasil")
      , [N,L] = X.useState(!1)
      , m = !!r
      , h = s === "Brasil" ? l.filter(f => f.brasil) : s === "Todos" ? l : l.filter(f => f.grupo === s)
      , T = (f, p, v) => {
        if (m)
            return;
        L(!1);
        const x = v === "" ? void 0 : Math.max(0, Math.min(20, parseInt(v) || 0));
        u(b => ({
            ...b,
            [f]: {
                ...b[f],
                [p]: x
            }
        }))
    }
      , M = Object.values(a).filter(f => f && f.casa != null && f.fora != null).length
      , J = () => {
        t({
            placares: a
        }),
        L(!0),
        $p()
    }
    ;
    return i.jsx("div", {
        onClick: n,
        style: {
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.95)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 10
        },
        children: i.jsxs("div", {
            onClick: f => f.stopPropagation(),
            style: {
                background: o.surface,
                border: `1px solid ${o.border}`,
                borderRadius: 16,
                width: "100%",
                maxWidth: 560,
                maxHeight: "94vh",
                overflowY: "auto",
                padding: 20
            },
            children: [i.jsxs("div", {
                style: {
                    position: "sticky",
                    top: 0,
                    zIndex: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: o.surface,
                    margin: "-20px -20px 14px",
                    padding: "16px 20px 12px",
                    borderBottom: `1px solid ${o.border}`,
                    boxShadow: "0 6px 14px -10px rgba(0,0,0,0.6)"
                },
                children: [i.jsxs("div", {
                    children: [i.jsx("div", {
                        style: {
                            fontFamily: "'Barlow Condensed',sans-serif",
                            fontSize: 22,
                            fontWeight: 800,
                            letterSpacing: 1
                        },
                        children: m ? "MEUS PALPITES" : "FAZER PALPITE"
                    }), i.jsx("div", {
                        style: {
                            fontSize: 13,
                            color: o.accent,
                            fontWeight: 600,
                            marginTop: 2
                        },
                        children: A.nome
                    })]
                }), i.jsx("button", {
                    onClick: n,
                    "aria-label": "Fechar",
                    style: {
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: o.bg,
                        border: `1px solid ${o.border}`,
                        color: o.text,
                        fontSize: 20,
                        cursor: "pointer",
                        flexShrink: 0
                    },
                    children: "✕"
                })]
            }), m ? i.jsx("div", {
                style: {
                    background: H(o.error, 12),
                    border: `1px solid ${H(o.error, 40)}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    marginBottom: 14,
                    fontSize: 13,
                    color: o.error
                },
                children: "🔒 A janela de palpites desta fase está fechada. Não é mais possível alterar."
            }) : i.jsxs("div", {
                style: {
                    background: o.greenDim,
                    border: `1px solid ${H(o.green, 27)}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    marginBottom: 14,
                    fontSize: 12,
                    color: o.green
                },
                children: ["✓ Você pode salvar aos poucos (até por grupo) e ", i.jsx("strong", {
                    children: "alterar quando quiser"
                }), " até a janela fechar (10/06)."]
            }), i.jsxs("div", {
                style: {
                    marginBottom: 12
                },
                children: [i.jsx("label", {
                    style: z.label,
                    children: "FILTRAR JOGOS"
                }), i.jsx("div", {
                    style: {
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 5
                    },
                    children: ["Brasil", "Todos", ...new Set(l.map(f => f.grupo).filter(Boolean))].map(f => i.jsx("button", {
                        onClick: () => y(f),
                        style: {
                            padding: "4px 10px",
                            borderRadius: 12,
                            fontSize: 11,
                            cursor: "pointer",
                            border: `1px solid ${s === f ? o.primary : o.border}`,
                            background: s === f ? o.primaryDim : "transparent",
                            color: s === f ? o.primary : o.textMid
                        },
                        children: f === "Brasil" ? "🇧🇷 Brasil" : f === "Todos" ? "Todos" : f.length <= 2 ? `Grp ${f}` : f
                    }, f))
                })]
            }), i.jsxs("div", {
                style: {
                    fontSize: 11,
                    color: o.textDim,
                    marginBottom: 10
                },
                children: [h.length, " jogos · Grupos: ", cl, "/", fl, " · Eliminatórias: ", $a, "/", Ao, " pts"]
            }), h.map(f => {
                var p, v;
                return i.jsxs("div", {
                    style: {
                        background: o.bg,
                        borderRadius: 10,
                        padding: "10px 12px",
                        marginBottom: 7,
                        border: `1px solid ${f.brasil ? H(o.primary, 27) : o.border}`
                    },
                    children: [i.jsxs("div", {
                        style: {
                            fontSize: 10,
                            color: o.textDim,
                            marginBottom: 5
                        },
                        children: ["Grupo ", f.grupo, " · ", f.data, " ", f.hora, " (Brasília) ", f.brasil ? "🇧🇷" : ""]
                    }), i.jsxs("div", {
                        style: {
                            display: "flex",
                            alignItems: "center",
                            gap: 8
                        },
                        children: [i.jsxs("span", {
                            style: {
                                flex: 1,
                                fontSize: 12,
                                display: "flex",
                                alignItems: "center",
                                gap: 6
                            },
                            children: [i.jsx(rA, {
                                t: f.casa
                            }), " ", f.casa]
                        }), i.jsx("input", {
                            type: "number",
                            min: 0,
                            max: 20,
                            disabled: m,
                            className: "campo-placar",
                            inputMode: "numeric",
                            value: ((p = a[f.id]) == null ? void 0 : p.casa) ?? "",
                            onChange: x => {
                                T(f.id, "casa", x.target.value),
                                x.target.value !== "" && dl(x.target)
                            }
                            ,
                            style: {
                                width: 48,
                                minHeight: 44,
                                textAlign: "center",
                                background: o.surface,
                                border: `1px solid ${o.border}`,
                                borderRadius: 8,
                                padding: "5px 2px",
                                color: o.text,
                                fontSize: 18,
                                fontWeight: 700
                            }
                        }), i.jsx("span", {
                            style: {
                                color: o.textDim
                            },
                            children: "×"
                        }), i.jsx("input", {
                            type: "number",
                            min: 0,
                            max: 20,
                            disabled: m,
                            className: "campo-placar",
                            inputMode: "numeric",
                            value: ((v = a[f.id]) == null ? void 0 : v.fora) ?? "",
                            onChange: x => {
                                T(f.id, "fora", x.target.value),
                                x.target.value !== "" && dl(x.target)
                            }
                            ,
                            style: {
                                width: 48,
                                minHeight: 44,
                                textAlign: "center",
                                background: o.surface,
                                border: `1px solid ${o.border}`,
                                borderRadius: 8,
                                padding: "5px 2px",
                                color: o.text,
                                fontSize: 18,
                                fontWeight: 700
                            }
                        }), i.jsxs("span", {
                            style: {
                                flex: 1,
                                fontSize: 12,
                                textAlign: "right"
                            },
                            children: [f.fora, " ", i.jsx(rA, {
                                t: f.fora
                            })]
                        })]
                    })]
                }, f.id)
            }
            ), !m && i.jsxs("div", {
                style: {
                    position: "sticky",
                    bottom: 0,
                    marginTop: 14,
                    paddingTop: 12,
                    paddingBottom: 4,
                    background: o.surface,
                    borderTop: `1px solid ${o.border}`
                },
                children: [i.jsx("button", {
                    onClick: J,
                    style: z.btn("primary", {
                        width: "100%",
                        padding: "14px",
                        fontSize: 15,
                        background: N ? o.green : o.primary
                    }),
                    children: N ? "✓ Salvo!" : `Salvar palpites${M ? ` (${M})` : ""}`
                }), i.jsx("div", {
                    style: {
                        fontSize: 11,
                        color: o.textDim,
                        textAlign: "center",
                        marginTop: 6
                    },
                    children: "Não precisa preencher tudo · salve aos poucos e edite até 10/06"
                })]
            }), m && i.jsx("div", {
                style: {
                    position: "sticky",
                    bottom: 0,
                    marginTop: 14,
                    paddingTop: 12,
                    paddingBottom: 4,
                    background: o.surface,
                    borderTop: `1px solid ${o.border}`
                },
                children: i.jsx("button", {
                    onClick: n,
                    style: z.btn("ghost", {
                        width: "100%",
                        padding: "14px",
                        fontSize: 15
                    }),
                    children: "Fechar"
                })
            })]
        })
    })
}
function x1() {
    var zo;
    const [A,e] = X.useState( () => {
        try {
            const d = localStorage.getItem("bolao_user");
            return d ? JSON.parse(d) : null
        } catch {
            return null
        }
    }
    );
    X.useEffect( () => {
        try {
            A ? localStorage.setItem("bolao_user", JSON.stringify(A)) : localStorage.removeItem("bolao_user")
        } catch {}
    }
    , [A]);
    const [t,n] = X.useState([])
      , [r,l] = X.useState({})
      , [a,u] = X.useState("")
      , s = X.useMemo( () => {
        const d = new Set(ra.map(V => V.id));
        return [...ra, ...t.filter(V => !d.has(V.id))].map(V => r[V.id] ? {
            ...V,
            ...r[V.id]
        } : V)
    }
    , [t, r])
      , [y,N] = X.useState([])
      , L = X.useMemo( () => {
        const d = new Set(Tn.map(j => j.id));
        return [...Tn, ...y.filter(j => !d.has(j.id))]
    }
    , [y]);
    X.useEffect( () => {
        vA.getConfig().then(d => {
            const j = (d || []).find(K => K.chave === "participantes_extras");
            if (j != null && j.valor)
                try {
                    n(JSON.parse(j.valor))
                } catch {}
            const V = (d || []).find(K => K.chave === "jogos_extra");
            if (V != null && V.valor)
                try {
                    N(JSON.parse(V.valor))
                } catch {}
            const W = (d || []).find(K => K.chave === "participantes_edits");
            if (W != null && W.valor)
                try {
                    l(JSON.parse(W.valor))
                } catch {}
            const F = (d || []).find(K => K.chave === "regras");
            F != null && F.valor && u(F.valor)
        }
        ).catch( () => {}
        )
    }
    , []);
    const [m,h] = X.useState({})
      , [T,M] = X.useState({})
      , [J,f] = X.useState("")
      , [p,v] = X.useState({
        ...Object.fromEntries(gt.map(d => [d.id, "auto"])),
        campeao: "auto"
    })
      , [x,b] = X.useState("")
      , [O,k] = X.useState(null)
      , [w,Y] = X.useState(!1)
      , [U,xA] = X.useState( () => {
        try {
            return localStorage.getItem("bolao_aba") || "inicio"
        } catch {
            return "inicio"
        }
    }
    );
    X.useEffect( () => {
        try {
            localStorage.setItem("bolao_aba", U)
        } catch {}
    }
    , [U]),
    X.useEffect( () => {
        if (!A)
            return;
        (A.admin ? ["inicio", "ranking", "premiacao", "admin"] : ["inicio", "jogos", "ranking", "premiacao", "regras"]).includes(U) || xA("inicio")
    }
    , [A]);
    const [YA,Qe] = X.useState("resultados")
      , [_e,nn] = X.useState(null)
      , [$e,rn] = X.useState(null)
      , [g,R] = X.useState("C")
      , [Z,tA] = X.useState("Todos")
      , [cA,At] = X.useState(!1)
      , [DA,et] = X.useState({})
      , [BA,tt] = X.useState("")
      , [to,no] = X.useState("")
      , [ro,lo] = X.useState("")
      , [jt,HA] = X.useState(null)
      , [oc,Xl] = X.useState(null)
      , [io,ao] = X.useState("")
      , [oo,uo] = X.useState("")
      , [nr,so] = X.useState(null)
      , [co,fo] = X.useState("")
      , [ql,Ol] = X.useState(null)
      , [rr,uc] = X.useState("r32")
      , [Nt,po] = X.useState("")
      , [St,yo] = X.useState("")
      , [vo,mo] = X.useState("")
      , [Lo,xo] = X.useState("")
      , [kl,Tt] = X.useState(null)
      , [Pl,sc] = X.useState(Ac)
      , [nt,dc] = X.useState( () => new Date)
      , Ve = !Zu("grupos", nt, p);
    X.useEffect( () => {
        const j = setInterval( () => dc(new Date), Ve ? 3e4 : 1e3);
        return () => clearInterval(j)
    }
    , [Ve]),
    X.useEffect( () => {
        ec(Pl)
    }
    , [Pl]),
    X.useEffect( () => {
        et({
            ...T
        })
    }
    , [T]),
    X.useEffect( () => {
        tt(J)
    }
    , [J]),
    X.useEffect( () => {
        fo(a)
    }
    , [a]),
    X.useEffect( () => {
        var d;
        A && b(((d = m[A.id]) == null ? void 0 : d.campeao) || "")
    }
    , [A, m]);
    const [rt,jo] = X.useState({})
      , [wl,Ul] = X.useState(null);
    X.useEffect( () => {
        if (!A) {
            Ul(null);
            return
        }
        try {
            Ul(localStorage.getItem("bolao_avatar_" + A.id))
        } catch {}
    }
    , [A]);
    const cc = d => {
        if (!d || !A)
            return;
        const j = new FileReader;
        j.onload = V => {
            const W = new Image;
            W.onload = () => {
                const K = document.createElement("canvas");
                K.width = 160,
                K.height = 160;
                const nA = K.getContext("2d")
                  , fA = Math.min(W.width, W.height);
                nA.drawImage(W, (W.width - fA) / 2, (W.height - fA) / 2, fA, fA, 0, 0, 160, 160);
                const sA = K.toDataURL("image/jpeg", .78);
                try {
                    localStorage.setItem("bolao_avatar_" + A.id, sA)
                } catch {}
                Ul(sA),
                jo(PA => ({
                    ...PA,
                    [A.id]: sA
                })),
                vA.salvarConfig("avatar_" + A.id, sA).catch( () => {}
                )
            }
            ,
            W.src = V.target.result
        }
        ,
        j.readAsDataURL(d)
    }
    ;
    X.useEffect( () => {
        A && fc()
    }
    , [A]);
    const fc = async () => {
        At(!0);
        try {
            const [d,j,V,W] = await Promise.all([vA.getJogos(), vA.getPalpites(), vA.getCampeoes(), vA.getConfig()])
              , F = {};
            (d || []).forEach(c => {
                c.gols_casa !== null && c.gols_fora !== null && (F[c.id] = {
                    casa: c.gols_casa,
                    fora: c.gols_fora
                })
            }
            ),
            (W || []).forEach(c => {
                var P;
                if ((P = c.chave) != null && P.startsWith("placar_") && c.valor != null) {
                    const G = Number(c.chave.slice(7))
                      , [B,D] = String(c.valor).split("-").map(Number);
                    !Number.isNaN(B) && !Number.isNaN(D) && (F[G] = {
                        casa: B,
                        fora: D
                    })
                }
            }
            ),
            M(F);
            const K = (W || []).find(c => c.chave === "jogos_extra");
            if (K != null && K.valor)
                try {
                    N(JSON.parse(K.valor))
                } catch {}
            else
                N([]);
            const nA = {
                ...Object.fromEntries(gt.map(c => [c.id, "auto"])),
                campeao: "auto"
            };
            (W || []).forEach(c => {
                var P;
                if ((P = c.chave) != null && P.startsWith("janela_")) {
                    const G = c.chave.slice(7);
                    G in nA && (nA[G] = c.valor === "true" ? "aberta" : c.valor === "false" ? "fechada" : ["auto", "aberta", "fechada"].includes(c.valor) ? c.valor : "auto")
                }
            }
            ),
            v(nA);
            const fA = (W || []).find(c => c.chave === "campeao_real");
            fA != null && fA.valor && f(fA.valor);
            const sA = (W || []).find(c => c.chave === "participantes_edits");
            if (sA != null && sA.valor)
                try {
                    l(JSON.parse(sA.valor))
                } catch {}
            const PA = (W || []).find(c => c.chave === "regras");
            u((PA == null ? void 0 : PA.valor) || "");
            const de = {};
            (W || []).forEach(c => {
                var P;
                (P = c.chave) != null && P.startsWith("avatar_") && c.valor && (de[c.chave.slice(7)] = c.valor)
            }
            ),
            jo(de);
            const JA = {};
            (j || []).forEach(c => {
                JA[c.participante_id] || (JA[c.participante_id] = {
                    placares: {},
                    confirmado: !1
                }),
                JA[c.participante_id].placares[c.jogo_id] = {
                    casa: c.gols_casa,
                    fora: c.gols_fora
                },
                c.confirmado && (JA[c.participante_id].confirmado = !0)
            }
            ),
            (V || []).forEach(c => {
                JA[c.participante_id] || (JA[c.participante_id] = {
                    placares: {},
                    confirmado: !1
                }),
                JA[c.participante_id].campeao = c.selecao
            }
            ),
            h(JA)
        } catch (d) {
            console.error("Erro ao carregar:", d)
        }
        At(!1)
    }
      , _ = A ? m[A.id] : null
      , lr = L.filter(d => {
        var j;
        return ((j = T[d.id]) == null ? void 0 : j.casa) !== void 0
    }
    )
      , jA = X.useMemo( () => s.filter(d => !d.admin).map(d => {
        const j = m[d.id] || {};
        let V = 0
          , W = 0
          , F = 0
          , K = 0;
        return L.forEach(nA => {
            var JA;
            const fA = T[nA.id]
              , sA = (JA = j.placares) == null ? void 0 : JA[nA.id]
              , PA = Rr(sA, fA);
            if (PA === null)
                return;
            const de = Mr(nA);
            V += Ln(sA, fA, de),
            de || (W += Ln(sA, fA, !1)),
            PA === "exato" ? F++ : PA === "venc" && K++
        }
        ),
        {
            ...d,
            total: V,
            grupos: W,
            exatos: F,
            vencedores: K,
            palpitou: !!j.confirmado,
            campeao: j.campeao || ""
        }
    }
    ).sort( (d, j) => j.total - d.total || j.palpitou - d.palpitou || j.exatos - d.exatos || j.vencedores - d.vencedores || (d.nome || "").localeCompare(j.nome || "", "pt")), [m, T, s, L])
      , ht = jA.filter(d => d.palpitou).length
      , QA = o1(nt, p.campeao || "auto")
      , No = X.useMemo( () => [...new Set(y.filter(d => d.fase === "quartas").flatMap(d => [d.casa, d.fora]).filter(Boolean))].sort( (d, j) => d.localeCompare(j, "pt")), [y])
      , NA = A && ((zo = m[A.id]) == null ? void 0 : zo.campeao) || ""
      , ir = J ? jA.filter(d => d.campeao === J) : []
      , pc = ir.length ? a1 / ir.length : 0
      , yc = async d => {
        if (!(!A || QA !== "aberta")) {
            b(d),
            h(j => ({
                ...j,
                [A.id]: {
                    ...j[A.id] || {
                        placares: {}
                    },
                    campeao: d
                }
            })),
            k({
                tipo: "ok",
                txt: "✓ Palpite de campeão salvo! Pode alterar até o fechamento."
            });
            try {
                await vA.salvarCampeao(A.id, d)
            } catch (j) {
                console.error(j),
                k({
                    tipo: "erro",
                    txt: "Erro ao salvar — tente novamente."
                })
            }
        }
    }
      , Mt = d => d === 0 ? o.gold : d === 1 ? o.silver : d === 2 ? o.bronze : o.textDim
      , vc = d => d === 0 ? "🥇" : d === 1 ? "🥈" : d === 2 ? "🥉" : null
      , mc = _e !== null ? jA.filter(d => d.nome.toLowerCase().includes(_e.toLowerCase())) : jA
      , Lc = L.map(d => {
        var K;
        const j = (K = _ == null ? void 0 : _.placares) == null ? void 0 : K[d.id]
          , V = T[d.id]
          , W = Rr(j, V)
          , F = Ln(j, V, Mr(d));
        return {
            ...d,
            pal: j,
            res: V,
            pts: F,
            cat: W
        }
    }
    )
      , me = A ? jA.find(d => d.id === A.id) : null
      , xc = (d, j) => !!d && !!j && d.getFullYear() === j.getFullYear() && d.getMonth() === j.getMonth() && d.getDate() === j.getDate()
      , ln = L.map(d => {
        var W;
        const j = T[d.id]
          , V = (j == null ? void 0 : j.casa) !== void 0;
        return {
            ...d,
            ini: ac(d),
            res: j,
            temRes: V,
            pal: (W = _ == null ? void 0 : _.placares) == null ? void 0 : W[d.id],
            status: d1(d, nt, V)
        }
    }
    )
      , an = ln.filter(d => d.status === "ao_vivo")
      , So = ln.filter(d => xc(d.ini, nt) && !d.temRes)
      , jc = ln.filter(d => !d.temRes).length
      , To = ln.filter(d => d.ini && d.ini >= nt && !d.temRes).sort( (d, j) => d.ini - j.ini).slice(0, 5)
      , ho = ln.filter(d => d.temRes).sort( (d, j) => {
        var V, W;
        return (((V = j.ini) == null ? void 0 : V.getTime()) || 0) - (((W = d.ini) == null ? void 0 : W.getTime()) || 0)
    }
    ).slice(0, 4)
      , Mo = jA.filter(d => d.palpitou)
      , Wl = Mo.slice(0, 5)
      , bt = A ? Mo.findIndex(d => d.id === A.id) : -1
      , on = i1.getTime() - nt.getTime()
      , ar = on > 0 ? ( () => {
        const d = Math.floor(on / 1e3);
        return {
            d: Math.floor(d / 86400),
            h: Math.floor(d % 86400 / 3600),
            m: Math.floor(d % 3600 / 60),
            s: d % 60
        }
    }
    )() : null
      , bo = on <= 0 ? "off" : on < 12 * 36e5 ? "alta" : on < 48 * 36e5 ? "media" : "baixa"
      , Nc = () => {
        const d = new Set(t.map(c => c.id))
          , j = async c => {
            n(c);
            try {
                await vA.salvarConfig("participantes_extras", JSON.stringify(c))
            } catch (P) {
                console.error(P)
            }
        }
          , V = () => {
            const c = to.trim()
              , P = hn(ro);
            if (c.length < 2) {
                HA({
                    tipo: "erro",
                    txt: "Informe o nome completo."
                });
                return
            }
            if (P.length < 11) {
                HA({
                    tipo: "erro",
                    txt: "CPF inválido (11 dígitos)."
                });
                return
            }
            if (s.some(D => D.cpf && hn(D.cpf) === P)) {
                HA({
                    tipo: "erro",
                    txt: "Já existe um participante com esse CPF."
                });
                return
            }
            const B = {
                id: "ext" + Date.now(),
                nome: c,
                cpf: P
            };
            j([...t, B]),
            no(""),
            lo(""),
            HA({
                tipo: "ok",
                txt: `✓ ${c} adicionado!`
            })
        }
          , W = c => {
            j(t.filter(G => G.id !== c));
            const P = {
                ...r
            };
            delete P[c],
            l(P),
            vA.salvarConfig("participantes_edits", JSON.stringify(P)).catch(G => console.error(G))
        }
          , F = c => {
            Xl(c.id),
            ao(c.nome || ""),
            uo(c.cpf ? br(c.cpf) : ""),
            HA(null)
        }
          , K = c => {
            const P = io.trim()
              , G = hn(oo);
            if (P.length < 2) {
                HA({
                    tipo: "erro",
                    txt: "Informe o nome completo."
                });
                return
            }
            if (G.length !== 11) {
                HA({
                    tipo: "erro",
                    txt: "CPF inválido (11 dígitos)."
                });
                return
            }
            if (s.some(SA => SA.id !== c && SA.cpf && hn(SA.cpf) === G)) {
                HA({
                    tipo: "erro",
                    txt: "Já existe outro participante com esse CPF."
                });
                return
            }
            const D = {
                ...r,
                [c]: {
                    nome: P,
                    cpf: G
                }
            };
            l(D),
            vA.salvarConfig("participantes_edits", JSON.stringify(D)).catch(SA => console.error(SA)),
            Xl(null),
            HA({
                tipo: "ok",
                txt: `✓ ${P} atualizado!`
            })
        }
          , nA = async () => {
            const c = co.trim();
            u(c);
            try {
                await vA.salvarConfig("regras", c),
                Ol({
                    tipo: "ok",
                    txt: "✓ Regras salvas!"
                })
            } catch (P) {
                console.error(P),
                Ol({
                    tipo: "erro",
                    txt: "Erro ao salvar."
                })
            }
        }
          , fA = gt.filter(c => c.id !== "grupos")
          , sA = async c => {
            N(c);
            try {
                await vA.salvarConfig("jogos_extra", JSON.stringify(c))
            } catch (P) {
                console.error(P)
            }
        }
          , PA = () => {
            if (!Nt || !St) {
                Tt({
                    tipo: "erro",
                    txt: "Escolha os dois times."
                });
                return
            }
            if (Nt === St) {
                Tt({
                    tipo: "erro",
                    txt: "Os times devem ser diferentes."
                });
                return
            }
            const c = eo[rr]
              , G = {
                id: Math.max(72, ...L.map(B => Number(B.id) || 0)) + 1,
                casa: Nt,
                fora: St,
                grupo: (c == null ? void 0 : c.nome) || rr,
                fase: rr,
                data: vo.trim(),
                hora: Lo.trim() || "16h",
                brasil: Nt === "Brasil" || St === "Brasil"
            };
            sA([...y, G]),
            po(""),
            yo(""),
            mo(""),
            xo(""),
            Tt({
                tipo: "ok",
                txt: `✓ ${Nt} x ${St} adicionado!`
            })
        }
          , de = c => {
            sA(y.filter(P => P.id !== c))
        }
          , JA = (g === "Todos" ? L : L.filter(c => c.grupo === g)).filter(c => Z === "Todos" || c.rodada === parseInt(Z));
        return i.jsxs("div", {
            children: [i.jsx("div", {
                style: {
                    display: "flex",
                    gap: 6,
                    marginBottom: 18,
                    overflowX: "auto",
                    paddingBottom: 2
                },
                children: [["resultados", "⚽ Resultados"], ["jogos", "➕ Jogos"], ["janelas", "🗓️ Janelas"], ["participantes", "👥 Participantes"], ["regras", "📋 Regras"]].map( ([c,P]) => i.jsx("button", {
                    onClick: () => Qe(c),
                    style: z.btn(YA === c ? "primary" : "dim", {
                        borderRadius: 8,
                        padding: "8px 14px",
                        fontSize: 12,
                        whiteSpace: "nowrap"
                    }),
                    children: P
                }, c))
            }), YA === "resultados" && i.jsxs("div", {
                children: [i.jsxs("div", {
                    style: {
                        marginBottom: 12
                    },
                    children: [i.jsx("div", {
                        style: {
                            fontSize: 10,
                            color: o.textDim,
                            letterSpacing: 2,
                            marginBottom: 5
                        },
                        children: "RODADA"
                    }), i.jsx("div", {
                        style: {
                            display: "flex",
                            gap: 5,
                            marginBottom: 10
                        },
                        children: ["Todos", "1", "2", "3"].map(c => i.jsx("button", {
                            onClick: () => tA(c),
                            style: {
                                padding: "4px 10px",
                                borderRadius: 12,
                                fontSize: 11,
                                cursor: "pointer",
                                border: `1px solid ${Z === c ? o.primary : o.border}`,
                                background: Z === c ? o.primaryDim : "transparent",
                                color: Z === c ? o.primary : o.textMid
                            },
                            children: c === "Todos" ? "Todos" : `${c}ª Rodada`
                        }, c))
                    }), i.jsx("div", {
                        style: {
                            fontSize: 10,
                            color: o.textDim,
                            letterSpacing: 2,
                            marginBottom: 5
                        },
                        children: "GRUPO"
                    }), i.jsx("div", {
                        style: {
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 4
                        },
                        children: ["Todos", ...Object.keys(r1)].map(c => i.jsx("button", {
                            onClick: () => R(c),
                            style: {
                                padding: "3px 9px",
                                borderRadius: 11,
                                fontSize: 10,
                                cursor: "pointer",
                                border: `1px solid ${g === c ? o.primary : o.border}`,
                                background: g === c ? o.primaryDim : "transparent",
                                color: g === c ? o.primary : o.textMid
                            },
                            children: c === "Todos" ? "Todos" : `Grp ${c}`
                        }, c))
                    })]
                }), JA.map(c => {
                    var P, G, B;
                    return i.jsxs("div", {
                        style: z.card({
                            marginBottom: 7,
                            border: `1px solid ${((P = DA[c.id]) == null ? void 0 : P.casa) !== void 0 ? H(o.primary, 33) : o.border}`
                        }),
                        children: [i.jsxs("div", {
                            style: {
                                fontSize: 9,
                                color: o.textDim,
                                marginBottom: 5
                            },
                            children: ["Grp ", c.grupo, " · ", c.data, " ", c.hora, " ", c.brasil ? "🇧🇷" : ""]
                        }), i.jsxs("div", {
                            style: {
                                display: "flex",
                                alignItems: "center",
                                gap: 8
                            },
                            children: [i.jsxs("span", {
                                style: {
                                    flex: 1,
                                    fontSize: 12,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6
                                },
                                children: [i.jsx(rA, {
                                    t: c.casa
                                }), " ", c.casa]
                            }), i.jsx("input", {
                                type: "number",
                                min: 0,
                                max: 20,
                                className: "campo-placar",
                                inputMode: "numeric",
                                value: ((G = DA[c.id]) == null ? void 0 : G.casa) ?? "",
                                onChange: D => {
                                    const SA = D.target.value;
                                    et(un => ({
                                        ...un,
                                        [c.id]: {
                                            ...un[c.id],
                                            casa: Math.max(0, parseInt(SA) || 0)
                                        }
                                    })),
                                    SA !== "" && dl(D.target)
                                }
                                ,
                                style: {
                                    width: 48,
                                    minHeight: 44,
                                    textAlign: "center",
                                    background: o.bg,
                                    border: `1px solid ${o.primary}`,
                                    borderRadius: 8,
                                    padding: "5px 2px",
                                    color: o.text,
                                    fontSize: 17,
                                    fontWeight: 700
                                }
                            }), i.jsx("span", {
                                style: {
                                    color: o.textDim
                                },
                                children: "×"
                            }), i.jsx("input", {
                                type: "number",
                                min: 0,
                                max: 20,
                                className: "campo-placar",
                                inputMode: "numeric",
                                value: ((B = DA[c.id]) == null ? void 0 : B.fora) ?? "",
                                onChange: D => {
                                    const SA = D.target.value;
                                    et(un => ({
                                        ...un,
                                        [c.id]: {
                                            ...un[c.id],
                                            fora: Math.max(0, parseInt(SA) || 0)
                                        }
                                    })),
                                    SA !== "" && dl(D.target)
                                }
                                ,
                                style: {
                                    width: 48,
                                    minHeight: 44,
                                    textAlign: "center",
                                    background: o.bg,
                                    border: `1px solid ${o.primary}`,
                                    borderRadius: 8,
                                    padding: "5px 2px",
                                    color: o.text,
                                    fontSize: 17,
                                    fontWeight: 700
                                }
                            }), i.jsxs("span", {
                                style: {
                                    flex: 1,
                                    fontSize: 12,
                                    textAlign: "right"
                                },
                                children: [c.fora, " ", i.jsx(rA, {
                                    t: c.fora
                                })]
                            })]
                        })]
                    }, c.id)
                }
                ), i.jsxs("div", {
                    style: z.card({
                        marginTop: 14,
                        marginBottom: 12
                    }),
                    children: [i.jsx("label", {
                        style: z.label,
                        children: "🏆 CAMPEÃO REAL (lançar só após a final)"
                    }), i.jsxs("select", {
                        value: BA,
                        onChange: c => tt(c.target.value),
                        style: z.input({
                            padding: "11px 14px"
                        }),
                        children: [i.jsx("option", {
                            value: "",
                            children: "-- Ainda não definido --"
                        }), si.map(c => i.jsx("option", {
                            value: c,
                            children: c
                        }, c))]
                    }), i.jsxs("div", {
                        style: {
                            fontSize: 11.5,
                            color: o.textMid,
                            marginTop: 10,
                            lineHeight: 1.8
                        },
                        children: ["Janela do campeão: ", i.jsx("strong", {
                            style: {
                                color: QA === "aberta" ? o.green : QA === "encerrada" ? o.error : o.textDim
                            },
                            children: QA === "aberta" ? "ABERTA" : QA === "encerrada" ? "ENCERRADA" : "BLOQUEADA"
                        }), " · ", jA.filter(c => c.campeao).length, " de ", jA.length, " já escolheram", J && i.jsxs(i.Fragment, {
                            children: [i.jsx("br", {}), "Acertadores: ", i.jsx("strong", {
                                style: {
                                    color: o.gold
                                },
                                children: ir.length
                            }), ir.length > 0 ? i.jsxs(i.Fragment, {
                                children: [" · cada um leva ", i.jsxs("strong", {
                                    style: {
                                        color: o.gold
                                    },
                                    children: ["R$ ", pc.toLocaleString("pt-BR", {
                                        minimumFractionDigits: 2
                                    })]
                                })]
                            }) : " · prêmio não distribuído nesta categoria"]
                        })]
                    })]
                }), i.jsx("button", {
                    onClick: async () => {
                        M(DA),
                        f(BA);
                        try {
                            const c = Object.entries(DA).filter( ([,P]) => (P == null ? void 0 : P.casa) !== void 0 && (P == null ? void 0 : P.fora) !== void 0).map( ([P,G]) => {
                                const B = parseInt(P);
                                return Tn.some(D => D.id === B) ? vA.salvarResultado(B, G.casa, G.fora) : vA.salvarConfig("placar_" + B, G.casa + "-" + G.fora)
                            }
                            );
                            await Promise.all(c),
                            BA !== void 0 && await vA.salvarConfig("campeao_real", BA),
                            alert("Resultados salvos!")
                        } catch (c) {
                            alert("Erro ao salvar: " + c.message)
                        }
                    }
                    ,
                    style: z.btn("primary", {
                        width: "100%",
                        padding: "13px",
                        fontSize: 15
                    }),
                    children: "SALVAR RESULTADOS"
                })]
            }), YA === "janelas" && i.jsxs("div", {
                children: [i.jsxs("div", {
                    style: {
                        fontSize: 13,
                        color: o.textMid,
                        marginBottom: 16,
                        lineHeight: 1.6
                    },
                    children: ["Cada fase abre/fecha ", i.jsx("strong", {
                        style: {
                            color: o.text
                        },
                        children: "automaticamente pela data"
                    }), " (fecha 1 dia antes do início). Use ", i.jsx("strong", {
                        style: {
                            color: o.text
                        },
                        children: "Forçar"
                    }), " só quando precisar abrir/fechar manualmente (ex: confrontos do mata-mata definidos em cima da hora)."]
                }), gt.map(c => {
                    const P = p[c.id] || "auto"
                      , G = Zu(c.id, nt, p)
                      , B = async D => {
                        v(SA => ({
                            ...SA,
                            [c.id]: D
                        }));
                        try {
                            await vA.salvarConfig("janela_" + c.id, D)
                        } catch (SA) {
                            console.error(SA)
                        }
                    }
                    ;
                    return i.jsxs("div", {
                        style: z.card({
                            marginBottom: 10
                        }),
                        children: [i.jsxs("div", {
                            style: {
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: 10,
                                marginBottom: 10
                            },
                            children: [i.jsxs("div", {
                                children: [i.jsx("div", {
                                    style: {
                                        fontWeight: 700,
                                        fontSize: 14
                                    },
                                    children: c.nome
                                }), i.jsxs("div", {
                                    style: {
                                        fontSize: 11,
                                        color: o.textDim,
                                        marginTop: 2
                                    },
                                    children: [c.periodo, " · fecha ", new Date(c.fecha).toLocaleDateString("pt-BR")]
                                })]
                            }), i.jsx("div", {
                                style: {
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: G ? o.green : o.textDim,
                                    whiteSpace: "nowrap"
                                },
                                children: G ? "● Aberta" : "○ Fechada"
                            })]
                        }), i.jsx("div", {
                            style: {
                                display: "flex",
                                gap: 6
                            },
                            children: [["auto", "Automático"], ["aberta", "Forçar abrir"], ["fechada", "Forçar fechar"]].map( ([D,SA]) => i.jsx("button", {
                                onClick: () => B(D),
                                style: z.btn(P === D ? "primary" : "dim", {
                                    flex: 1,
                                    padding: "8px 6px",
                                    fontSize: 11,
                                    borderRadius: 8
                                }),
                                children: SA
                            }, D))
                        })]
                    }, c.id)
                }
                ), ( () => {
                    const c = p.campeao || "auto"
                      , P = async B => {
                        v(D => ({
                            ...D,
                            campeao: B
                        }));
                        try {
                            await vA.salvarConfig("janela_campeao", B)
                        } catch (D) {
                            console.error(D)
                        }
                    }
                      , G = QA === "aberta" ? o.green : QA === "encerrada" ? o.error : o.textDim;
                    return i.jsxs("div", {
                        style: z.card({
                            marginBottom: 10,
                            border: `1px solid ${H(o.gold, 35)}`
                        }),
                        children: [i.jsxs("div", {
                            style: {
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: 10,
                                marginBottom: 10
                            },
                            children: [i.jsxs("div", {
                                children: [i.jsx("div", {
                                    style: {
                                        fontWeight: 700,
                                        fontSize: 14
                                    },
                                    children: "🏆 Palpite do Campeão"
                                }), i.jsxs("div", {
                                    style: {
                                        fontSize: 11,
                                        color: o.textDim,
                                        marginTop: 2
                                    },
                                    children: ["abre ", new Date(lc).toLocaleDateString("pt-BR"), " · fecha ", new Date(ic).toLocaleDateString("pt-BR")]
                                })]
                            }), i.jsx("div", {
                                style: {
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: G,
                                    whiteSpace: "nowrap"
                                },
                                children: QA === "aberta" ? "● Aberta" : QA === "encerrada" ? "○ Encerrada" : "🔒 Bloqueada"
                            })]
                        }), i.jsx("div", {
                            style: {
                                display: "flex",
                                gap: 6
                            },
                            children: [["auto", "Automático"], ["aberta", "Forçar abrir"], ["fechada", "Forçar fechar"]].map( ([B,D]) => i.jsx("button", {
                                onClick: () => P(B),
                                style: z.btn(c === B ? "primary" : "dim", {
                                    flex: 1,
                                    padding: "8px 6px",
                                    fontSize: 11,
                                    borderRadius: 8
                                }),
                                children: D
                            }, B))
                        })]
                    })
                }
                )()]
            }), YA === "jogos" && i.jsxs("div", {
                children: [i.jsxs("div", {
                    style: z.card({
                        marginBottom: 12
                    }),
                    children: [i.jsx("label", {
                        style: z.label,
                        children: "➕ ADICIONAR JOGO (mata-mata / extra)"
                    }), i.jsx("div", {
                        style: {
                            fontSize: 12,
                            color: o.textMid,
                            marginBottom: 10
                        },
                        children: "Use quando os confrontos das fases finais forem definidos. Entram no app na hora (sem republicar)."
                    }), i.jsx("select", {
                        value: rr,
                        onChange: c => {
                            uc(c.target.value),
                            Tt(null)
                        }
                        ,
                        style: z.input({
                            marginBottom: 8,
                            fontSize: 14
                        }),
                        children: fA.map(c => i.jsx("option", {
                            value: c.id,
                            children: c.nome
                        }, c.id))
                    }), i.jsxs("div", {
                        style: {
                            display: "flex",
                            gap: 8,
                            marginBottom: 8
                        },
                        children: [i.jsxs("select", {
                            value: Nt,
                            onChange: c => {
                                po(c.target.value),
                                Tt(null)
                            }
                            ,
                            style: z.input({
                                fontSize: 14
                            }),
                            children: [i.jsx("option", {
                                value: "",
                                children: "Time 1…"
                            }), si.map(c => i.jsx("option", {
                                value: c,
                                children: c
                            }, c))]
                        }), i.jsxs("select", {
                            value: St,
                            onChange: c => {
                                yo(c.target.value),
                                Tt(null)
                            }
                            ,
                            style: z.input({
                                fontSize: 14
                            }),
                            children: [i.jsx("option", {
                                value: "",
                                children: "Time 2…"
                            }), si.map(c => i.jsx("option", {
                                value: c,
                                children: c
                            }, c))]
                        })]
                    }), i.jsxs("div", {
                        style: {
                            display: "flex",
                            gap: 8,
                            marginBottom: 8
                        },
                        children: [i.jsx("input", {
                            value: vo,
                            onChange: c => mo(c.target.value),
                            placeholder: "Data (ex: 28/06)",
                            style: z.input({
                                fontSize: 14
                            })
                        }), i.jsx("input", {
                            value: Lo,
                            onChange: c => xo(c.target.value),
                            placeholder: "Hora (ex: 16h)",
                            style: z.input({
                                fontSize: 14
                            })
                        })]
                    }), kl && i.jsx("div", {
                        style: {
                            fontSize: 12,
                            marginBottom: 8,
                            color: kl.tipo === "ok" ? o.green : o.error
                        },
                        children: kl.txt
                    }), i.jsx("button", {
                        onClick: PA,
                        style: z.btn("primary", {
                            width: "100%",
                            padding: "12px",
                            fontSize: 14
                        }),
                        children: "Adicionar jogo"
                    })]
                }), y.length === 0 ? i.jsx("div", {
                    style: z.card({
                        textAlign: "center",
                        color: o.textMid,
                        fontSize: 13
                    }),
                    children: "Nenhum jogo extra ainda. Os 72 jogos de grupos já estão no sistema."
                }) : y.map(c => i.jsxs("div", {
                    style: z.card({
                        marginBottom: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px"
                    }),
                    children: [i.jsxs("div", {
                        style: {
                            flex: 1,
                            minWidth: 0
                        },
                        children: [i.jsxs("div", {
                            style: {
                                fontSize: 13,
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: 6
                            },
                            children: [i.jsx(rA, {
                                t: c.casa,
                                h: 14
                            }), " ", c.casa, " × ", c.fora, " ", i.jsx(rA, {
                                t: c.fora,
                                h: 14
                            })]
                        }), i.jsxs("div", {
                            style: {
                                fontSize: 10,
                                color: o.textDim,
                                marginTop: 2
                            },
                            children: [c.grupo, " · ", c.data, " ", c.hora]
                        })]
                    }), i.jsx("button", {
                        onClick: () => de(c.id),
                        title: "Remover",
                        style: {
                            background: "none",
                            border: "none",
                            color: o.error,
                            fontSize: 16,
                            cursor: "pointer"
                        },
                        children: "✕"
                    })]
                }, c.id))]
            }), YA === "participantes" && i.jsxs("div", {
                children: [i.jsxs("div", {
                    style: z.card({
                        marginBottom: 12
                    }),
                    children: [i.jsx("label", {
                        style: z.label,
                        children: "➕ ADICIONAR PARTICIPANTE"
                    }), i.jsx("input", {
                        value: to,
                        onChange: c => {
                            no(c.target.value),
                            HA(null)
                        }
                        ,
                        placeholder: "Nome completo",
                        style: z.input({
                            marginBottom: 8,
                            fontSize: 14
                        })
                    }), i.jsx("input", {
                        value: ro,
                        onChange: c => {
                            lo(br(c.target.value)),
                            HA(null)
                        }
                        ,
                        inputMode: "numeric",
                        placeholder: "CPF (só números)",
                        style: z.input({
                            marginBottom: 8,
                            fontSize: 14
                        })
                    }), jt && i.jsx("div", {
                        style: {
                            fontSize: 12,
                            marginBottom: 8,
                            color: jt.tipo === "ok" ? o.green : o.error
                        },
                        children: jt.txt
                    }), i.jsx("button", {
                        onClick: V,
                        style: z.btn("primary", {
                            width: "100%",
                            padding: "12px",
                            fontSize: 14
                        }),
                        children: "Adicionar"
                    }), i.jsx("div", {
                        style: {
                            fontSize: 11,
                            color: o.textDim,
                            marginTop: 8
                        },
                        children: "O participante entra pelo app usando o CPF cadastrado."
                    })]
                }), i.jsxs("div", {
                    style: {
                        ...z.card({
                            marginBottom: 12,
                            background: o.surface
                        })
                    },
                    children: [i.jsxs("div", {
                        style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                        },
                        children: [i.jsxs("div", {
                            children: [i.jsx("div", {
                                style: {
                                    fontWeight: 700,
                                    fontSize: 15
                                },
                                children: "Palpites registrados"
                            }), i.jsxs("div", {
                                style: {
                                    fontSize: 12,
                                    color: o.textMid,
                                    marginTop: 2
                                },
                                children: [ht, " de ", jA.length, " participantes"]
                            })]
                        }), i.jsxs("div", {
                            style: {
                                fontFamily: "'Barlow Condensed',sans-serif",
                                fontSize: 36,
                                fontWeight: 900,
                                color: o.primary
                            },
                            children: [Math.round(ht / jA.length * 100), "%"]
                        })]
                    }), i.jsx("div", {
                        style: {
                            background: o.border,
                            borderRadius: 4,
                            height: 6,
                            marginTop: 12,
                            overflow: "hidden"
                        },
                        children: i.jsx("div", {
                            className: "grow-bar",
                            style: {
                                background: o.primary,
                                height: "100%",
                                borderRadius: 4,
                                width: `${ht / jA.length * 100}%`,
                                transition: "width 0.5s"
                            }
                        })
                    })]
                }), jA.map(c => oc === c.id ? i.jsxs("div", {
                    style: z.card({
                        marginBottom: 6,
                        padding: "12px 14px"
                    }),
                    children: [i.jsx("label", {
                        style: z.label,
                        children: "✏️ EDITAR PARTICIPANTE"
                    }), i.jsx("input", {
                        value: io,
                        onChange: P => {
                            ao(P.target.value),
                            HA(null)
                        }
                        ,
                        placeholder: "Nome completo",
                        style: z.input({
                            marginBottom: 8,
                            fontSize: 14
                        })
                    }), i.jsx("input", {
                        value: oo,
                        onChange: P => {
                            uo(br(P.target.value)),
                            HA(null)
                        }
                        ,
                        inputMode: "numeric",
                        placeholder: "CPF (só números)",
                        style: z.input({
                            marginBottom: 8,
                            fontSize: 14
                        })
                    }), jt && i.jsx("div", {
                        style: {
                            fontSize: 12,
                            marginBottom: 8,
                            color: jt.tipo === "ok" ? o.green : o.error
                        },
                        children: jt.txt
                    }), i.jsxs("div", {
                        style: {
                            display: "flex",
                            gap: 8
                        },
                        children: [i.jsx("button", {
                            onClick: () => K(c.id),
                            style: z.btn("primary", {
                                flex: 1,
                                padding: "10px",
                                fontSize: 13
                            }),
                            children: "Salvar"
                        }), i.jsx("button", {
                            onClick: () => Xl(null),
                            style: z.btn("ghost", {
                                flex: 1,
                                padding: "10px",
                                fontSize: 13
                            }),
                            children: "Cancelar"
                        })]
                    })]
                }, c.id) : i.jsxs("div", {
                    style: {
                        marginBottom: 6
                    },
                    children: [i.jsxs("div", {
                        style: z.card({
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 14px",
                            opacity: c.palpitou ? 1 : .6
                        }),
                        children: [i.jsx("div", {
                            style: {
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: c.palpitou ? o.green : o.border,
                                flexShrink: 0
                            }
                        }), i.jsxs("div", {
                            onClick: () => so(nr === c.id ? null : c.id),
                            style: {
                                flex: 1,
                                minWidth: 0,
                                cursor: "pointer"
                            },
                            title: "Ver palpites",
                            children: [i.jsx("div", {
                                style: {
                                    fontSize: 13,
                                    fontWeight: 600,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                },
                                children: c.nome
                            }), i.jsxs("div", {
                                style: {
                                    fontSize: 10,
                                    color: o.textDim,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                    flexWrap: "wrap"
                                },
                                children: [c.cpf ? br(c.cpf) : "Sem CPF cadastrado", c.campeao && i.jsxs("span", {
                                    style: {
                                        color: o.gold,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 3
                                    },
                                    children: ["· 🏆 ", i.jsx(rA, {
                                        t: c.campeao,
                                        h: 9
                                    }), " ", c.campeao, J && c.campeao === J ? " ✓" : ""]
                                })]
                            })]
                        }), i.jsx("div", {
                            style: {
                                fontSize: 11,
                                color: c.palpitou ? o.green : o.textDim,
                                flexShrink: 0
                            },
                            children: c.palpitou ? `✓ ${c.total}pts` : "Pendente"
                        }), i.jsx("button", {
                            onClick: () => so(nr === c.id ? null : c.id),
                            title: "Ver palpites",
                            style: {
                                background: "none",
                                border: "none",
                                color: nr === c.id ? o.primary : o.textDim,
                                fontSize: 15,
                                cursor: "pointer",
                                flexShrink: 0,
                                padding: "0 2px"
                            },
                            children: "👁"
                        }), i.jsx("button", {
                            onClick: () => F(c),
                            title: "Editar nome/CPF",
                            style: {
                                background: "none",
                                border: "none",
                                color: o.accent,
                                fontSize: 15,
                                cursor: "pointer",
                                flexShrink: 0,
                                padding: "0 2px"
                            },
                            children: "✏️"
                        }), d.has(c.id) && i.jsx("button", {
                            onClick: () => W(c.id),
                            title: "Remover (adicionado manualmente)",
                            style: {
                                background: "none",
                                border: "none",
                                color: o.error,
                                fontSize: 16,
                                cursor: "pointer",
                                flexShrink: 0,
                                padding: "0 2px"
                            },
                            children: "✕"
                        })]
                    }), nr === c.id && ( () => {
                        var B;
                        const P = ((B = m[c.id]) == null ? void 0 : B.placares) || {}
                          , G = L.filter(D => P[D.id] && P[D.id].casa != null && P[D.id].fora != null);
                        return i.jsxs("div", {
                            style: z.card({
                                marginTop: 4,
                                padding: "12px 14px",
                                background: o.surface
                            }),
                            children: [i.jsxs("div", {
                                style: {
                                    fontSize: 12,
                                    fontWeight: 700,
                                    marginBottom: 8
                                },
                                children: [G.length, " de ", L.length, " jogos palpitados", c.campeao ? i.jsxs(i.Fragment, {
                                    children: [" · campeão: ", i.jsxs("span", {
                                        style: {
                                            color: o.gold
                                        },
                                        children: [i.jsx(rA, {
                                            t: c.campeao,
                                            h: 10
                                        }), " ", c.campeao]
                                    })]
                                }) : ""]
                            }), G.length === 0 ? i.jsx("div", {
                                style: {
                                    fontSize: 12,
                                    color: o.textMid
                                },
                                children: "Ainda não fez nenhum palpite."
                            }) : G.map(D => i.jsxs("div", {
                                style: {
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 11,
                                    padding: "3px 0",
                                    borderBottom: `1px solid ${o.border}`
                                },
                                children: [i.jsxs("span", {
                                    style: {
                                        flex: 1,
                                        color: o.textMid,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5
                                    },
                                    children: [i.jsx(rA, {
                                        t: D.casa,
                                        h: 11
                                    }), " ", D.casa]
                                }), i.jsxs("strong", {
                                    style: {
                                        color: o.text
                                    },
                                    children: [P[D.id].casa, "×", P[D.id].fora]
                                }), i.jsxs("span", {
                                    style: {
                                        flex: 1,
                                        textAlign: "right",
                                        color: o.textMid,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "flex-end",
                                        gap: 5
                                    },
                                    children: [D.fora, " ", i.jsx(rA, {
                                        t: D.fora,
                                        h: 11
                                    })]
                                })]
                            }, D.id))]
                        })
                    }
                    )()]
                }, c.id))]
            }), YA === "regras" && i.jsx("div", {
                children: i.jsxs("div", {
                    style: z.card({
                        marginBottom: 12
                    }),
                    children: [i.jsx("label", {
                        style: z.label,
                        children: "📋 REGRAS DO BOLÃO (texto livre)"
                    }), i.jsxs("div", {
                        style: {
                            fontSize: 12,
                            color: o.textMid,
                            marginBottom: 10,
                            lineHeight: 1.5
                        },
                        children: ["Este texto aparece no topo da aba ", i.jsx("strong", {
                            children: "Regras"
                        }), " para todos os participantes. Use para avisos, premiação, prazos ou qualquer combinação. Deixe em branco para não exibir."]
                    }), i.jsx("textarea", {
                        value: co,
                        onChange: c => {
                            fo(c.target.value),
                            Ol(null)
                        }
                        ,
                        placeholder: `Ex.:
• Aposta de cada fase fecha 1 dia antes do 1º jogo.
• Em caso de empate na pontuação, ganha quem acertou mais placares exatos.
• Premiação na fase de grupos e na Copa inteira (veja a aba Prêmios).`,
                        rows: 10,
                        style: z.input({
                            fontSize: 14,
                            lineHeight: 1.6,
                            resize: "vertical",
                            fontFamily: "inherit"
                        })
                    }), ql && i.jsx("div", {
                        style: {
                            fontSize: 12,
                            marginTop: 8,
                            color: ql.tipo === "ok" ? o.green : o.error
                        },
                        children: ql.txt
                    }), i.jsx("button", {
                        onClick: nA,
                        style: z.btn("primary", {
                            width: "100%",
                            padding: "12px",
                            fontSize: 14,
                            marginTop: 10
                        }),
                        children: "Salvar regras"
                    })]
                })
            })]
        })
    }
    ;
    if (!A)
        return i.jsx(m1, {
            onLogin: e,
            participantes: s
        });
    const Le = !!A.admin
      , Sc = Le ? [["inicio", "🏠", "Início"], ["ranking", "🏆", "Ranking"], ["premiacao", "🎁", "Prêmios"], ["admin", "⚙️", "Admin"]] : [["inicio", "🏠", "Início"], ["jogos", "⚽", "Jogos"], ["ranking", "🏆", "Ranking"], ["premiacao", "🎁", "Prêmios"], ["regras", "📋", "Regras"]];
    return i.jsxs("div", {
        style: {
            minHeight: "100dvh",
            background: o.bg,
            color: o.text
        },
        children: [i.jsx("style", {
            children: `
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
        *{font-family:'Barlow',sans-serif;-webkit-tap-highlight-color:transparent;box-sizing:border-box;font-variant-numeric:tabular-nums;}
        html{touch-action:manipulation;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        select option{background:${o.card};}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-thumb{background:${o.border};border-radius:2px;}
        button:focus-visible,a:focus-visible,select:focus-visible,input:focus-visible{
          outline:2px solid ${o.accent};outline-offset:2px;
          box-shadow:0 0 0 3px ${H(o.accent, 35)};border-radius:6px;
        }
        /* Feedback de toque */
        button{transition:transform .12s ease, opacity .15s ease;}
        button:active{transform:scale(.96);}
        /* Pulso do "ao vivo" */
        @keyframes pulseDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.8)}}
        .ao-vivo-dot{animation:pulseDot 1.1s ease-in-out infinite;}
        /* Entrada suave ao trocar de aba */
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .tab-anim{animation:fadeUp .26s ease both;}
        /* Reveal escalonado dos blocos da Home */
        .stagger>*{animation:fadeUp .34s ease both;}
        .stagger>*:nth-child(1){animation-delay:.03s}
        .stagger>*:nth-child(2){animation-delay:.08s}
        .stagger>*:nth-child(3){animation-delay:.13s}
        .stagger>*:nth-child(4){animation-delay:.18s}
        .stagger>*:nth-child(5){animation-delay:.23s}
        .stagger>*:nth-child(6){animation-delay:.28s}
        .stagger>*:nth-child(7){animation-delay:.33s}
        /* Barra de progresso crescendo */
        @keyframes growBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        .grow-bar{transform-origin:left;animation:growBar .8s .15s cubic-bezier(.22,1,.36,1) both;}
        /* Confete ao salvar a aposta */
        @keyframes confFall{to{transform:translateY(108vh) rotate(720deg);opacity:0}}
        @media (prefers-reduced-motion:reduce){
          *{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;}
        }
      `
        }), w && i.jsx(L1, {
            user: A,
            palpites: _,
            travado: Ve,
            jogos: L,
            onSalvar: async d => {
                h(j => ({
                    ...j,
                    [A.id]: {
                        ...j[A.id],
                        ...d,
                        confirmado: !0
                    }
                }));
                try {
                    const j = Object.entries(d.placares || {}).filter( ([,V]) => V && V.casa != null && V.fora != null).map( ([V,W]) => vA.salvarPalpite(A.id, parseInt(V), W.casa, W.fora));
                    await Promise.all(j)
                } catch (j) {
                    console.error("Erro ao salvar palpite:", j)
                }
            }
            ,
            onFechar: () => Y(!1)
        }), i.jsxs("div", {
            style: {
                position: "sticky",
                top: 0,
                zIndex: 90,
                backgroundColor: o.surface,
                backgroundImage: `${_p}, radial-gradient(130% 90% at 50% -25%, rgba(255,255,255,0.07), transparent 60%), ${o.headerGrad}`,
                borderBottom: `1px solid ${o.border}`
            },
            children: [i.jsxs("div", {
                style: {
                    maxWidth: 700,
                    margin: "0 auto",
                    padding: "calc(16px + env(safe-area-inset-top)) 16px 0"
                },
                children: [i.jsxs("div", {
                    style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 12
                    },
                    children: [i.jsxs("div", {
                        children: [i.jsxs("div", {
                            style: {
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                marginBottom: 6,
                                flexWrap: "wrap"
                            },
                            children: [i.jsx("img", {
                                src: tc,
                                alt: "Usee",
                                style: {
                                    height: 26,
                                    objectFit: "contain",
                                    filter: "brightness(0) invert(1)",
                                    opacity: .95
                                }
                            }), i.jsx("img", {
                                src: nc,
                                alt: "Weesu",
                                style: {
                                    height: 26,
                                    objectFit: "contain",
                                    mixBlendMode: "screen",
                                    opacity: .95
                                }
                            }), i.jsx("img", {
                                src: rc,
                                alt: "NOR",
                                style: {
                                    height: 18,
                                    objectFit: "contain",
                                    filter: "brightness(0) invert(1)",
                                    opacity: .8
                                }
                            })]
                        }), i.jsxs("div", {
                            style: {
                                fontFamily: "'Barlow Condensed',sans-serif",
                                fontSize: 22,
                                fontWeight: 900,
                                letterSpacing: 1,
                                lineHeight: 1.1
                            },
                            children: ["BOLÃO COPA DO", i.jsx("br", {}), i.jsx("span", {
                                style: {
                                    color: o.primary
                                },
                                children: "MUNDO 2026"
                            })]
                        })]
                    }), i.jsxs("div", {
                        style: {
                            textAlign: "right",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 6
                        },
                        children: [i.jsx("div", {
                            style: {
                                fontSize: 12,
                                color: o.textMid,
                                maxWidth: 120,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap"
                            },
                            children: A.nome.split(" ")[0]
                        }), i.jsxs("div", {
                            style: {
                                display: "flex",
                                gap: 6,
                                alignItems: "center"
                            },
                            children: [i.jsx("select", {
                                "aria-label": "Trocar tema",
                                value: Pl,
                                onChange: d => sc(d.target.value),
                                style: {
                                    background: o.surface,
                                    border: `1px solid ${o.border}`,
                                    color: o.textMid,
                                    borderRadius: 8,
                                    padding: "5px 8px",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    outline: "none"
                                },
                                children: Object.entries(Qn).map( ([d,j]) => i.jsxs("option", {
                                    value: d,
                                    children: [j.icone, " ", j.nome]
                                }, d))
                            }), i.jsx("button", {
                                onClick: () => e(null),
                                style: z.btn("dim", {
                                    padding: "5px 10px",
                                    fontSize: 11,
                                    borderRadius: 8
                                }),
                                children: "Sair"
                            })]
                        })]
                    })]
                }), ( () => {
                    if (Le)
                        return i.jsx("div", {
                            style: {
                                marginTop: 10,
                                padding: "9px 12px",
                                borderRadius: 10,
                                background: o.surface,
                                border: `1px solid ${o.border}`,
                                fontSize: 12.5,
                                color: o.textMid,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap"
                            },
                            children: i.jsxs("span", {
                                children: ["👥 ", i.jsxs("strong", {
                                    style: {
                                        color: o.text
                                    },
                                    children: [ht, "/", jA.length]
                                }), " apostaram"]
                            })
                        });
                    if (Ve)
                        return i.jsx("div", {
                            style: {
                                marginTop: 10,
                                padding: "11px 14px",
                                borderRadius: 10,
                                background: o.surface,
                                border: `1px solid ${o.border}`,
                                fontSize: 13,
                                color: o.textMid
                            },
                            children: "🔒 Apostas encerradas — acompanhe os jogos e o ranking"
                        });
                    const d = Tn.length
                      , j = Object.values((_ == null ? void 0 : _.placares) || {}).filter(nA => nA && nA.casa != null && nA.fora != null).length
                      , V = j >= d
                      , W = bo === "alta" ? o.error : bo === "media" ? o.warn : o.accent
                      , F = j === 0 ? "Você ainda não palpitou" : V ? "✓ Palpites completos" : `Faltam ${d - j} jogos pra completar`
                      , K = V ? "Editar" : j === 0 ? "Palpitar" : "Completar";
                    return i.jsxs("div", {
                        style: {
                            marginTop: 10,
                            padding: "10px 14px",
                            borderRadius: 10,
                            background: V ? o.greenDim : H(W, 12),
                            border: `1px solid ${H(V ? o.green : W, 40)}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10
                        },
                        children: [i.jsxs("div", {
                            style: {
                                minWidth: 0
                            },
                            children: [i.jsx("div", {
                                style: {
                                    fontSize: 13.5,
                                    fontWeight: 700,
                                    color: V ? o.green : o.text
                                },
                                children: F
                            }), ar && i.jsxs("div", {
                                style: {
                                    fontSize: 11.5,
                                    color: o.textMid,
                                    marginTop: 2,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 5
                                },
                                children: [i.jsx(qe, {
                                    name: "clock",
                                    size: 12,
                                    color: W
                                }), " fecha em ", i.jsxs("strong", {
                                    style: {
                                        color: W
                                    },
                                    children: [ar.d, "d ", String(ar.h).padStart(2, "0"), "h ", String(ar.m).padStart(2, "0"), "m"]
                                })]
                            })]
                        }), i.jsx("button", {
                            onClick: () => Y(!0),
                            style: z.btn("primary", {
                                padding: "9px 16px",
                                fontSize: 13,
                                borderRadius: 9,
                                whiteSpace: "nowrap",
                                background: V ? o.card : o.primary,
                                border: V ? `1px solid ${o.border}` : "none",
                                color: V ? o.text : o.onPrimary
                            }),
                            children: K
                        })]
                    })
                }
                )(), i.jsx("div", {
                    style: {
                        height: 12
                    }
                })]
            }), i.jsx("div", {
                style: {
                    height: 5,
                    background: $d
                }
            })]
        }), i.jsxs("div", {
            className: "tab-anim",
            style: {
                maxWidth: 700,
                margin: "0 auto",
                padding: "14px 14px 100px"
            },
            children: [U === "inicio" && i.jsxs("div", {
                className: "stagger",
                children: [i.jsxs("div", {
                    style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 16
                    },
                    children: [i.jsxs("label", {
                        title: "Adicionar/trocar foto",
                        style: {
                            position: "relative",
                            width: 48,
                            height: 48,
                            borderRadius: "50%",
                            border: `2px solid ${o.accent}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: 20,
                            color: o.text,
                            flexShrink: 0,
                            cursor: "pointer",
                            overflow: "hidden",
                            background: o.surface
                        },
                        children: [rt[A.id] || wl ? i.jsx("img", {
                            src: rt[A.id] || wl,
                            alt: "",
                            style: {
                                width: "100%",
                                height: "100%",
                                objectFit: "cover"
                            }
                        }) : (A.nome[0] || "?").toUpperCase(), !(rt[A.id] || wl) && i.jsx("span", {
                            style: {
                                position: "absolute",
                                right: -1,
                                bottom: -1,
                                width: 18,
                                height: 18,
                                borderRadius: "50%",
                                background: o.accent,
                                color: o.bg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 12,
                                fontWeight: 900,
                                border: `2px solid ${o.bg}`
                            },
                            children: "+"
                        }), i.jsx("input", {
                            type: "file",
                            accept: "image/*",
                            onChange: d => cc(d.target.files && d.target.files[0]),
                            style: {
                                display: "none"
                            }
                        })]
                    }), i.jsxs("div", {
                        style: {
                            minWidth: 0
                        },
                        children: [i.jsxs("div", {
                            style: {
                                fontSize: 20,
                                fontWeight: 800,
                                lineHeight: 1.15
                            },
                            children: ["Fala, ", A.nome.split(" ")[0], " 👋"]
                        }), i.jsx("div", {
                            style: {
                                fontSize: 13,
                                color: o.textMid,
                                marginTop: 2
                            },
                            children: Le ? "Painel do administrador" : Ve ? bt >= 0 ? i.jsxs(i.Fragment, {
                                children: ["Você está em ", i.jsxs("strong", {
                                    style: {
                                        color: o.gold
                                    },
                                    children: [bt + 1, "º lugar"]
                                })]
                            }) : "Acompanhe os jogos e o ranking" : _ != null && _.confirmado ? "Sua aposta está registrada ✓" : "Faça sua aposta até 10/06"
                        })]
                    })]
                }), (an.length > 0 || So.length > 0) && i.jsxs("div", {
                    style: z.card({
                        marginBottom: 14,
                        border: `1px solid ${an.length > 0 ? H(o.error, 50) : o.border}`
                    }),
                    children: [i.jsx("div", {
                        style: {
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 10
                        },
                        children: an.length > 0 ? i.jsxs(i.Fragment, {
                            children: [i.jsx("span", {
                                className: "ao-vivo-dot",
                                style: {
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: o.error,
                                    display: "inline-block"
                                }
                            }), i.jsx("span", {
                                style: {
                                    fontSize: 11,
                                    letterSpacing: 2,
                                    color: o.error,
                                    fontWeight: 800
                                },
                                children: "AO VIVO AGORA"
                            })]
                        }) : i.jsxs(i.Fragment, {
                            children: [i.jsx(qe, {
                                name: "calendar",
                                size: 15,
                                color: o.accent
                            }), i.jsx("span", {
                                style: {
                                    fontSize: 11,
                                    letterSpacing: 2,
                                    color: o.accent,
                                    fontWeight: 800
                                },
                                children: "JOGOS DE HOJE"
                            })]
                        })
                    }), (an.length > 0 ? an : So).map( (d, j) => i.jsxs("div", {
                        style: {
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            padding: "9px 0",
                            borderTop: j > 0 ? `1px solid ${o.border}` : "none"
                        },
                        children: [i.jsxs("span", {
                            style: {
                                fontSize: 14,
                                fontWeight: 600
                            },
                            children: [i.jsx(rA, {
                                t: d.casa
                            }), " ", d.casa, " ", i.jsx("span", {
                                style: {
                                    color: o.textDim
                                },
                                children: "×"
                            }), " ", d.fora, " ", i.jsx(rA, {
                                t: d.fora
                            })]
                        }), i.jsxs("span", {
                            style: {
                                fontSize: 11,
                                color: o.textMid,
                                whiteSpace: "nowrap"
                            },
                            children: [d.status === "ao_vivo" ? `começou ${d.hora}` : d.hora, !Le && d.pal ? ` · ${d.pal.casa}×${d.pal.fora}` : ""]
                        })]
                    }, d.id))]
                }), me && i.jsx("div", {
                    style: {
                        display: "flex",
                        gap: 8,
                        marginBottom: 14
                    },
                    children: [["chart", "Posição", bt >= 0 ? `${bt + 1}º` : "—", o.gold], ["star", "Pontos", `${me.total}`, o.win], ["clock", "Pendentes", `${jc}`, o.green]].map( ([d,j,V,W]) => i.jsxs("div", {
                        style: z.card({
                            flex: 1,
                            padding: "12px 8px"
                        }),
                        children: [i.jsx(qe, {
                            name: d,
                            size: 18,
                            color: W
                        }), i.jsx("div", {
                            style: {
                                fontSize: 9,
                                color: o.textDim,
                                letterSpacing: 1,
                                marginTop: 6
                            },
                            children: j.toUpperCase()
                        }), i.jsx("div", {
                            style: {
                                fontFamily: "'Barlow Condensed',sans-serif",
                                fontSize: 24,
                                fontWeight: 900,
                                marginTop: 2
                            },
                            children: V
                        })]
                    }, j))
                }), i.jsxs("div", {
                    style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8
                    },
                    children: [i.jsxs("div", {
                        style: {
                            fontSize: 13,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: 6
                        },
                        children: [i.jsx(qe, {
                            name: "trophy",
                            size: 16,
                            color: o.gold
                        }), " Top 3 do ranking"]
                    }), i.jsx("button", {
                        onClick: () => xA("ranking"),
                        style: {
                            background: "none",
                            border: "none",
                            color: o.green,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer"
                        },
                        children: "Ver completo ›"
                    })]
                }), Wl.length > 0 ? i.jsxs("div", {
                    style: z.card({
                        marginBottom: 14,
                        padding: 8
                    }),
                    children: [Wl.slice(0, 3).map( (d, j) => i.jsxs("div", {
                        style: {
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 6px",
                            borderBottom: j < Math.min(Wl.length, 3) - 1 ? `1px solid ${o.border}` : "none",
                            background: d.id === A.id ? o.meBg : "transparent",
                            borderRadius: 6
                        },
                        children: [i.jsx("div", {
                            style: {
                                width: 24,
                                height: 24,
                                borderRadius: "50%",
                                background: H(Mt(j), 20),
                                color: Mt(j),
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                                fontSize: 12,
                                flexShrink: 0
                            },
                            children: j + 1
                        }), rt[d.id] ? i.jsx("img", {
                            src: rt[d.id],
                            alt: "",
                            style: {
                                width: 26,
                                height: 26,
                                borderRadius: "50%",
                                objectFit: "cover",
                                flexShrink: 0
                            }
                        }) : i.jsx("div", {
                            style: {
                                width: 26,
                                height: 26,
                                borderRadius: "50%",
                                background: o.surface,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                color: o.textMid,
                                flexShrink: 0
                            },
                            children: (d.nome[0] || "?").toUpperCase()
                        }), i.jsxs("div", {
                            style: {
                                flex: 1,
                                fontSize: 13,
                                fontWeight: 600
                            },
                            children: [d.nome, d.id === A.id && i.jsx("span", {
                                style: {
                                    fontSize: 9,
                                    color: o.accent,
                                    marginLeft: 6
                                },
                                children: "VOCÊ"
                            })]
                        }), i.jsx("div", {
                            style: {
                                fontFamily: "'Barlow Condensed',sans-serif",
                                fontSize: 20,
                                fontWeight: 900,
                                color: Mt(j)
                            },
                            children: d.total
                        })]
                    }, d.id)), bt >= 3 && me && i.jsxs("div", {
                        style: {
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 6px",
                            marginTop: 4,
                            borderTop: `1px dashed ${o.border}`,
                            background: o.meBg,
                            borderRadius: 6
                        },
                        children: [i.jsxs("div", {
                            style: {
                                width: 24,
                                textAlign: "center",
                                fontWeight: 700,
                                color: o.accent,
                                fontSize: 12
                            },
                            children: [bt + 1, "º"]
                        }), i.jsxs("div", {
                            style: {
                                flex: 1,
                                fontSize: 13,
                                fontWeight: 600
                            },
                            children: [me.nome, i.jsx("span", {
                                style: {
                                    fontSize: 9,
                                    color: o.accent,
                                    marginLeft: 6
                                },
                                children: "VOCÊ"
                            })]
                        }), i.jsx("div", {
                            style: {
                                fontFamily: "'Barlow Condensed',sans-serif",
                                fontSize: 20,
                                fontWeight: 900
                            },
                            children: me.total
                        })]
                    })]
                }) : i.jsx("div", {
                    style: z.card({
                        marginBottom: 14,
                        textAlign: "center",
                        color: o.textMid,
                        fontSize: 13
                    }),
                    children: "O ranking aparece quando os primeiros resultados forem lançados."
                }), i.jsxs("div", {
                    style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8
                    },
                    children: [i.jsxs("div", {
                        style: {
                            fontSize: 13,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: 6
                        },
                        children: [i.jsx(qe, {
                            name: "calendar",
                            size: 16,
                            color: o.primary
                        }), " Próximos jogos"]
                    }), i.jsx("button", {
                        onClick: () => xA(Le ? "admin" : "jogos"),
                        style: {
                            background: "none",
                            border: "none",
                            color: o.green,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer"
                        },
                        children: "Ver todos ›"
                    })]
                }), To.length > 0 ? To.map(d => i.jsxs("div", {
                    style: z.card({
                        marginBottom: 7,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8
                    }),
                    children: [i.jsxs("div", {
                        style: {
                            minWidth: 0
                        },
                        children: [i.jsxs("div", {
                            style: {
                                fontSize: 14,
                                fontWeight: 600
                            },
                            children: [i.jsx(rA, {
                                t: d.casa
                            }), " ", d.casa, " ", i.jsx("span", {
                                style: {
                                    color: o.textDim
                                },
                                children: "×"
                            }), " ", d.fora, " ", i.jsx(rA, {
                                t: d.fora
                            })]
                        }), i.jsxs("div", {
                            style: {
                                fontSize: 11,
                                color: o.textDim,
                                marginTop: 3
                            },
                            children: [d.data, " · ", d.hora, " ", d.brasil ? "🇧🇷" : ""]
                        })]
                    }), !Le && (d.pal ? i.jsxs("span", {
                        style: {
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 11,
                            fontWeight: 700,
                            color: o.green,
                            background: o.greenDim,
                            border: `1px solid ${H(o.green, 40)}`,
                            borderRadius: 20,
                            padding: "5px 10px",
                            whiteSpace: "nowrap"
                        },
                        children: [i.jsx(qe, {
                            name: "check",
                            size: 12,
                            color: o.green
                        }), " Enviado"]
                    }) : i.jsxs("span", {
                        style: {
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 11,
                            fontWeight: 700,
                            color: o.warn,
                            border: `1px solid ${H(o.warn, 50)}`,
                            borderRadius: 20,
                            padding: "5px 10px",
                            whiteSpace: "nowrap"
                        },
                        children: [i.jsx(qe, {
                            name: "clock",
                            size: 12,
                            color: o.warn
                        }), " Pendente"]
                    }))]
                }, d.id)) : i.jsx("div", {
                    style: z.card({
                        marginBottom: 12,
                        textAlign: "center",
                        color: o.textMid,
                        fontSize: 13
                    }),
                    children: "Sem jogos futuros — a Copa terminou! 🏁"
                }), ho.length > 0 && i.jsxs(i.Fragment, {
                    children: [i.jsx("div", {
                        style: {
                            fontSize: 13,
                            fontWeight: 700,
                            margin: "12px 0 8px"
                        },
                        children: "📋 Últimos resultados"
                    }), ho.map(d => {
                        const j = Ln(d.pal, d.res, Mr(d));
                        return i.jsxs("div", {
                            style: z.card({
                                marginBottom: 6,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "10px 14px"
                            }),
                            children: [i.jsxs("span", {
                                style: {
                                    fontSize: 13
                                },
                                children: [i.jsx(rA, {
                                    t: d.casa
                                }), " ", d.casa, " ", i.jsxs("strong", {
                                    children: [d.res.casa, "×", d.res.fora]
                                }), " ", d.fora, " ", i.jsx(rA, {
                                    t: d.fora
                                })]
                            }), !Le && i.jsxs("span", {
                                style: {
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: j > 0 ? o.green : j === 0 ? o.error : o.textDim
                                },
                                children: [j !== null ? j > 0 ? `+${j}` : "0" : "—", d.pal ? ` (${d.pal.casa}×${d.pal.fora})` : ""]
                            })]
                        }, d.id)
                    }
                    )]
                }), i.jsxs("button", {
                    onClick: () => xA("premiacao"),
                    style: z.card({
                        width: "100%",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        border: `1px solid ${H(o.gold, 33)}`,
                        marginTop: 14
                    }),
                    children: [i.jsxs("div", {
                        children: [i.jsx("div", {
                            style: {
                                fontSize: 13,
                                fontWeight: 700,
                                color: o.gold
                            },
                            children: "🏆 R$ 5.000 em prêmios"
                        }), i.jsx("div", {
                            style: {
                                fontSize: 12,
                                color: o.textMid,
                                marginTop: 2
                            },
                            children: "Fase de grupos · Copa inteira · Palpite do campeão"
                        })]
                    }), i.jsx("span", {
                        style: {
                            fontSize: 18,
                            color: o.textDim
                        },
                        children: "›"
                    })]
                }), !Ve && i.jsxs("div", {
                    style: z.card({
                        marginTop: 12
                    }),
                    children: [i.jsxs("div", {
                        style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 10
                        },
                        children: [i.jsx("div", {
                            style: {
                                fontSize: 13,
                                fontWeight: 700
                            },
                            children: "🙋 Quem já apostou"
                        }), i.jsxs("div", {
                            style: {
                                fontSize: 13,
                                color: o.textMid
                            },
                            children: [ht, " de ", jA.length]
                        })]
                    }), i.jsx("div", {
                        style: {
                            background: o.surface,
                            borderRadius: 4,
                            height: 8,
                            overflow: "hidden"
                        },
                        children: i.jsx("div", {
                            className: "grow-bar",
                            style: {
                                background: o.primary,
                                height: "100%",
                                borderRadius: 4,
                                width: `${jA.length ? ht / jA.length * 100 : 0}%`,
                                transition: "width .5s"
                            }
                        })
                    })]
                })]
            }), U === "ranking" && i.jsxs("div", {
                children: [i.jsx("div", {
                    style: {
                        display: "flex",
                        gap: 8,
                        marginBottom: 12,
                        alignItems: "center"
                    },
                    children: _e === null ? i.jsx("button", {
                        onClick: () => nn(""),
                        style: z.btn("dim", {
                            borderRadius: 9,
                            padding: "9px 14px",
                            fontSize: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 6
                        }),
                        children: "🔍 Buscar"
                    }) : i.jsxs("div", {
                        style: {
                            flex: 1,
                            display: "flex",
                            gap: 6
                        },
                        children: [i.jsx("input", {
                            autoFocus: !0,
                            placeholder: "Nome do colaborador...",
                            value: _e,
                            onChange: d => nn(d.target.value),
                            style: z.input({
                                fontSize: 13,
                                padding: "9px 12px"
                            })
                        }), i.jsx("button", {
                            onClick: () => nn(null),
                            style: z.btn("dim", {
                                padding: "9px 12px",
                                fontSize: 12,
                                borderRadius: 9
                            }),
                            children: "✕"
                        })]
                    })
                }), lr.length === 0 && i.jsxs("div", {
                    style: z.card({
                        textAlign: "center",
                        padding: 20,
                        marginBottom: 12,
                        color: o.textMid,
                        fontSize: 13
                    }),
                    children: ["🗓️ Copa começa 11 de junho", i.jsx("br", {}), "Pontos aparecerão conforme os jogos forem lançados"]
                }), mc.map(d => {
                    const j = jA.filter(F => F.palpitou).findIndex(F => F.id === d.id)
                      , V = d.palpitou && j >= 0 && j < 3
                      , W = d.id === A.id;
                    return i.jsxs("div", {
                        style: z.card({
                            marginBottom: 7,
                            border: `1px solid ${W ? H(o.primary, 40) : V ? H(Mt(j), 27) : o.border}`,
                            background: W ? o.meBg : o.card,
                            opacity: d.palpitou ? 1 : .45
                        }),
                        children: [i.jsxs("div", {
                            style: {
                                display: "flex",
                                alignItems: "center",
                                gap: 10
                            },
                            children: [i.jsx("div", {
                                style: {
                                    width: 34,
                                    height: 34,
                                    borderRadius: "50%",
                                    background: V ? Mt(j) : o.border,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: V ? 17 : 12,
                                    fontWeight: 700,
                                    color: V ? o.bg : o.text,
                                    flexShrink: 0
                                },
                                children: d.palpitou ? vc(j) || j + 1 : "—"
                            }), rt[d.id] ? i.jsx("img", {
                                src: rt[d.id],
                                alt: "",
                                style: {
                                    width: 34,
                                    height: 34,
                                    borderRadius: "50%",
                                    objectFit: "cover",
                                    flexShrink: 0
                                }
                            }) : i.jsx("div", {
                                style: {
                                    width: 34,
                                    height: 34,
                                    borderRadius: "50%",
                                    background: o.surface,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: o.textMid,
                                    flexShrink: 0
                                },
                                children: (d.nome[0] || "?").toUpperCase()
                            }), i.jsxs("div", {
                                style: {
                                    flex: 1,
                                    minWidth: 0
                                },
                                children: [i.jsxs("div", {
                                    style: {
                                        fontWeight: 700,
                                        fontSize: 14,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5,
                                        flexWrap: "wrap"
                                    },
                                    children: [d.nome, W && i.jsx("span", {
                                        style: {
                                            fontSize: 9,
                                            background: o.accent,
                                            color: o.bg,
                                            borderRadius: 4,
                                            padding: "1px 5px",
                                            letterSpacing: 1,
                                            fontWeight: 700
                                        },
                                        children: "VOCÊ"
                                    })]
                                }), i.jsx("div", {
                                    style: {
                                        fontSize: 11,
                                        color: o.textDim,
                                        marginTop: 2
                                    },
                                    children: d.palpitou ? i.jsxs("span", {
                                        children: ["⭐ ", d.exatos, " exatos · ✅ ", d.vencedores, " certos"]
                                    }) : i.jsx("span", {
                                        style: {
                                            color: o.accent
                                        },
                                        children: "Palpite pendente"
                                    })
                                })]
                            }), i.jsx("div", {
                                style: {
                                    flexShrink: 0,
                                    textAlign: "right"
                                },
                                children: d.palpitou ? i.jsxs(i.Fragment, {
                                    children: [i.jsx("div", {
                                        style: {
                                            fontFamily: "'Barlow Condensed',sans-serif",
                                            fontSize: 32,
                                            fontWeight: 900,
                                            color: V ? Mt(j) : o.text,
                                            lineHeight: 1
                                        },
                                        children: d.total
                                    }), i.jsx("div", {
                                        style: {
                                            fontSize: 9,
                                            color: o.textDim,
                                            letterSpacing: 1
                                        },
                                        children: "PONTOS"
                                    })]
                                }) : W && !(_ != null && _.confirmado) ? i.jsx("button", {
                                    onClick: () => Y(!0),
                                    style: z.btn("primary", {
                                        padding: "7px 12px",
                                        fontSize: 11,
                                        borderRadius: 8
                                    }),
                                    children: "+ Palpitar"
                                }) : i.jsx("span", {
                                    style: {
                                        color: o.textDim,
                                        fontSize: 11
                                    },
                                    children: "—"
                                })
                            })]
                        }), d.palpitou && lr.length > 0 && i.jsxs(i.Fragment, {
                            children: [i.jsx("button", {
                                onClick: () => rn($e === d.id ? null : d.id),
                                style: {
                                    background: "none",
                                    border: "none",
                                    color: o.textDim,
                                    fontSize: 10,
                                    cursor: "pointer",
                                    marginTop: 8,
                                    width: "100%",
                                    textAlign: "center"
                                },
                                children: $e === d.id ? "▲ fechar" : "▼ ver detalhes"
                            }), $e === d.id && i.jsxs("div", {
                                style: {
                                    marginTop: 10,
                                    paddingTop: 10,
                                    borderTop: `1px solid ${o.border}`
                                },
                                children: [i.jsx("div", {
                                    style: {
                                        display: "flex",
                                        gap: 8,
                                        marginBottom: 10
                                    },
                                    children: [[o.gold, d.exatos, "⭐ EXATOS"], [o.win, d.vencedores, "✅ RESULTADO"]].map( ([F,K,nA]) => i.jsxs("div", {
                                        style: {
                                            flex: 1,
                                            background: o.surface,
                                            borderRadius: 8,
                                            padding: "8px",
                                            textAlign: "center"
                                        },
                                        children: [i.jsx("div", {
                                            style: {
                                                fontSize: 20,
                                                fontWeight: 700,
                                                color: F
                                            },
                                            children: K
                                        }), i.jsx("div", {
                                            style: {
                                                fontSize: 9,
                                                color: o.textDim
                                            },
                                            children: nA
                                        })]
                                    }, nA))
                                }), lr.map(F => {
                                    var PA, de;
                                    const K = (de = (PA = m[d.id]) == null ? void 0 : PA.placares) == null ? void 0 : de[F.id]
                                      , nA = T[F.id]
                                      , fA = Rr(K, nA)
                                      , sA = Ln(K, nA, Mr(F));
                                    return i.jsxs("div", {
                                        style: {
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 5,
                                            padding: "4px 0",
                                            borderBottom: `1px solid ${o.border}`,
                                            fontSize: 10
                                        },
                                        children: [i.jsxs("span", {
                                            style: {
                                                flex: 1,
                                                color: o.textMid
                                            },
                                            children: [i.jsx(rA, {
                                                t: F.casa
                                            }), " ", F.casa, " × ", F.fora, " ", i.jsx(rA, {
                                                t: F.fora
                                            })]
                                        }), i.jsx("span", {
                                            style: {
                                                fontWeight: 700,
                                                color: fA === "exato" ? o.gold : fA === "venc" ? o.win : fA === "errou" ? o.error : o.textDim
                                            },
                                            children: K ? `${K.casa}×${K.fora}` : "—"
                                        }), i.jsxs("span", {
                                            style: {
                                                color: o.textDim
                                            },
                                            children: ["(Real:", nA.casa, "×", nA.fora, ")"]
                                        }), sA !== null && i.jsxs("span", {
                                            style: {
                                                color: sA > 0 ? o.green : o.error,
                                                fontWeight: 700
                                            },
                                            children: ["+", sA]
                                        })]
                                    }, F.id)
                                }
                                )]
                            })]
                        })]
                    }, d.id)
                }
                )]
            }), U === "jogos" && !Le && i.jsxs("div", {
                children: [!(_ != null && _.confirmado) && !Ve && i.jsxs("div", {
                    style: z.card({
                        textAlign: "center",
                        padding: 36,
                        marginBottom: 12
                    }),
                    children: [i.jsx("div", {
                        style: {
                            fontSize: 48,
                            marginBottom: 12
                        },
                        children: "⚽"
                    }), i.jsx("div", {
                        style: {
                            fontSize: 18,
                            fontWeight: 700,
                            marginBottom: 8
                        },
                        children: "Você ainda não apostou!"
                    }), i.jsx("div", {
                        style: {
                            fontSize: 13,
                            color: o.textMid,
                            marginBottom: 24
                        },
                        children: "Registre seus palpites antes do prazo (10/06 à meia-noite)."
                    }), i.jsx("button", {
                        onClick: () => Y(!0),
                        style: z.btn("primary", {
                            padding: "13px 28px",
                            fontSize: 15
                        }),
                        children: "+ FAZER MEU PALPITE"
                    })]
                }), !(_ != null && _.confirmado) && Ve && i.jsxs("div", {
                    style: z.card({
                        textAlign: "center",
                        padding: 24,
                        marginBottom: 12,
                        border: `1px solid ${o.border}`
                    }),
                    children: [i.jsx("div", {
                        style: {
                            fontSize: 36,
                            marginBottom: 8
                        },
                        children: "😕"
                    }), i.jsx("div", {
                        style: {
                            fontSize: 16,
                            fontWeight: 700,
                            marginBottom: 4
                        },
                        children: "Você não apostou a tempo"
                    }), i.jsx("div", {
                        style: {
                            fontSize: 13,
                            color: o.textMid
                        },
                        children: "As apostas encerraram em 10/06. Você ainda pode acompanhar os jogos e resultados abaixo."
                    })]
                }), i.jsxs("div", {
                    children: [lr.length > 0 && me && (_ == null ? void 0 : _.confirmado) && i.jsx("div", {
                        style: {
                            display: "flex",
                            gap: 8,
                            marginBottom: 12
                        },
                        children: [[o.gold, "Exatos", me.exatos], [o.win, "Resultado", me.vencedores], [o.text, "Total pts", me.total]].map( ([d,j,V]) => i.jsxs("div", {
                            style: z.card({
                                flex: 1,
                                textAlign: "center",
                                padding: "10px 6px"
                            }),
                            children: [i.jsx("div", {
                                style: {
                                    fontSize: 22,
                                    fontWeight: 700,
                                    color: d
                                },
                                children: V
                            }), i.jsx("div", {
                                style: {
                                    fontSize: 9,
                                    color: o.textDim,
                                    letterSpacing: 1
                                },
                                children: j
                            })]
                        }, j))
                    }), Lc.map(d => i.jsxs("div", {
                        style: z.card({
                            marginBottom: 7,
                            border: `1px solid ${d.brasil ? H(o.primary, 20) : o.border}`
                        }),
                        children: [i.jsxs("div", {
                            style: {
                                fontSize: 10,
                                color: o.textDim,
                                marginBottom: 5
                            },
                            children: ["Grp ", d.grupo, " · ", d.data, " ", d.hora, " ", d.brasil ? "🇧🇷" : ""]
                        }), i.jsxs("div", {
                            style: {
                                display: "flex",
                                alignItems: "center",
                                gap: 8
                            },
                            children: [i.jsxs("div", {
                                style: {
                                    flex: 1
                                },
                                children: [i.jsxs("div", {
                                    style: {
                                        fontSize: 12,
                                        fontWeight: 600
                                    },
                                    children: [i.jsx(rA, {
                                        t: d.casa
                                    }), " ", d.casa]
                                }), i.jsxs("div", {
                                    style: {
                                        fontSize: 12,
                                        fontWeight: 600,
                                        marginTop: 2,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6
                                    },
                                    children: [i.jsx(rA, {
                                        t: d.fora
                                    }), " ", d.fora]
                                })]
                            }), i.jsxs("div", {
                                style: {
                                    textAlign: "center"
                                },
                                children: [i.jsx("div", {
                                    style: {
                                        fontSize: 10,
                                        color: o.textDim,
                                        marginBottom: 3
                                    },
                                    children: "Palpite"
                                }), i.jsx("div", {
                                    style: {
                                        fontFamily: "'Barlow Condensed',sans-serif",
                                        fontSize: 22,
                                        fontWeight: 900,
                                        color: d.cat === "exato" ? o.gold : d.cat === "venc" ? o.win : d.cat === "errou" ? o.error : o.text
                                    },
                                    children: d.pal ? `${d.pal.casa}×${d.pal.fora}` : "—"
                                })]
                            }), d.res && i.jsxs("div", {
                                style: {
                                    textAlign: "center"
                                },
                                children: [i.jsx("div", {
                                    style: {
                                        fontSize: 10,
                                        color: o.textDim,
                                        marginBottom: 3
                                    },
                                    children: "Real"
                                }), i.jsxs("div", {
                                    style: {
                                        fontFamily: "'Barlow Condensed',sans-serif",
                                        fontSize: 22,
                                        fontWeight: 900
                                    },
                                    children: [d.res.casa, "×", d.res.fora]
                                })]
                            }), d.pts !== null && i.jsxs("div", {
                                style: {
                                    textAlign: "center",
                                    minWidth: 40
                                },
                                children: [i.jsx("div", {
                                    style: {
                                        fontSize: 10,
                                        color: o.textDim,
                                        marginBottom: 3
                                    },
                                    children: "Pts"
                                }), i.jsxs("div", {
                                    style: {
                                        fontFamily: "'Barlow Condensed',sans-serif",
                                        fontSize: 22,
                                        fontWeight: 900,
                                        color: d.pts > 0 ? o.green : o.error
                                    },
                                    children: ["+", d.pts]
                                })]
                            })]
                        })]
                    }, d.id))]
                })]
            }), U === "premiacao" && i.jsxs("div", {
                children: [i.jsxs("div", {
                    style: {
                        background: `linear-gradient(135deg,${H(o.gold, 12)},${H(o.gold, 4)})`,
                        border: `2px solid ${H(o.gold, 33)}`,
                        borderRadius: 16,
                        padding: 24,
                        marginBottom: 16,
                        textAlign: "center"
                    },
                    children: [i.jsx("div", {
                        style: {
                            fontSize: 44,
                            marginBottom: 6
                        },
                        children: "🏆"
                    }), i.jsx("div", {
                        style: {
                            fontFamily: "'Barlow Condensed',sans-serif",
                            fontSize: 14,
                            letterSpacing: 3,
                            color: o.gold,
                            marginBottom: 4
                        },
                        children: "PREMIAÇÃO TOTAL"
                    }), i.jsx("div", {
                        style: {
                            fontFamily: "'Barlow Condensed',sans-serif",
                            fontSize: 46,
                            fontWeight: 900,
                            color: o.gold,
                            lineHeight: 1
                        },
                        children: "R$ 5.000"
                    }), i.jsxs("div", {
                        style: {
                            fontSize: 13,
                            color: o.textMid,
                            marginTop: 8,
                            lineHeight: 1.7
                        },
                        children: ["Dividida em três categorias: ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "fase de grupos"
                        }), ", ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "Copa inteira"
                        }), " e ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "palpite do campeão"
                        }), "."]
                    })]
                }), i.jsxs("div", {
                    style: z.card({
                        marginBottom: 12
                    }),
                    children: [i.jsxs("div", {
                        style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 10,
                            flexWrap: "wrap"
                        },
                        children: [i.jsx("div", {
                            style: {
                                fontFamily: "'Barlow Condensed',sans-serif",
                                fontSize: 22,
                                fontWeight: 800,
                                letterSpacing: 1
                            },
                            children: "⚽ FASE DE GRUPOS"
                        }), i.jsx("div", {
                            style: {
                                fontSize: 12,
                                fontWeight: 700,
                                color: o.textMid,
                                whiteSpace: "nowrap"
                            },
                            children: "Total R$ 1.500"
                        })]
                    }), [[o.gold, "🥇 1º lugar", "R$ 750,00"], [o.silver, "🥈 2º lugar", "R$ 450,00"], [o.bronze, "🥉 3º lugar", "R$ 300,00"]].map( ([d,j,V]) => i.jsxs("div", {
                        style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "12px 0",
                            borderBottom: `1px solid ${o.border}`
                        },
                        children: [i.jsx("span", {
                            style: {
                                fontSize: 15,
                                fontWeight: 600,
                                color: d
                            },
                            children: j
                        }), i.jsx("span", {
                            style: {
                                fontFamily: "'Barlow Condensed',sans-serif",
                                fontSize: 26,
                                fontWeight: 900,
                                color: d
                            },
                            children: V
                        })]
                    }, j))]
                }), i.jsxs("div", {
                    style: z.card({
                        marginBottom: 12
                    }),
                    children: [i.jsxs("div", {
                        style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 10,
                            flexWrap: "wrap"
                        },
                        children: [i.jsx("div", {
                            style: {
                                fontFamily: "'Barlow Condensed',sans-serif",
                                fontSize: 22,
                                fontWeight: 800,
                                letterSpacing: 1
                            },
                            children: "🌍 COPA INTEIRA"
                        }), i.jsx("div", {
                            style: {
                                fontSize: 12,
                                fontWeight: 700,
                                color: o.textMid,
                                whiteSpace: "nowrap"
                            },
                            children: "Total R$ 2.500"
                        })]
                    }), [[o.gold, "🥇 1º lugar", "R$ 1.250,00"], [o.silver, "🥈 2º lugar", "R$ 800,00"], [o.bronze, "🥉 3º lugar", "R$ 450,00"]].map( ([d,j,V]) => i.jsxs("div", {
                        style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "12px 0",
                            borderBottom: `1px solid ${o.border}`
                        },
                        children: [i.jsx("span", {
                            style: {
                                fontSize: 15,
                                fontWeight: 600,
                                color: d
                            },
                            children: j
                        }), i.jsx("span", {
                            style: {
                                fontFamily: "'Barlow Condensed',sans-serif",
                                fontSize: 26,
                                fontWeight: 900,
                                color: d
                            },
                            children: V
                        })]
                    }, j))]
                }), i.jsxs("div", {
                    style: {
                        background: `linear-gradient(135deg,${H(o.gold, 16)},${H(o.gold, 5)})`,
                        border: `2px solid ${H(o.gold, 45)}`,
                        borderRadius: 16,
                        padding: 20,
                        boxShadow: `0 0 0 1px ${H(o.gold, 10)}, 0 12px 34px -12px ${H(o.gold, 55)}`
                    },
                    children: [i.jsxs("div", {
                        style: {
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            marginBottom: 12
                        },
                        children: [i.jsx("div", {
                            style: {
                                fontSize: 40,
                                lineHeight: 1,
                                filter: `drop-shadow(0 2px 8px ${H(o.gold, 60)})`
                            },
                            children: "🏆"
                        }), i.jsxs("div", {
                            style: {
                                flex: 1,
                                minWidth: 0
                            },
                            children: [i.jsx("div", {
                                style: {
                                    fontFamily: "'Barlow Condensed',sans-serif",
                                    fontSize: 22,
                                    fontWeight: 900,
                                    letterSpacing: 1,
                                    color: o.gold
                                },
                                children: "PALPITE DO CAMPEÃO"
                            }), i.jsx("div", {
                                style: {
                                    fontSize: 12.5,
                                    color: o.textMid,
                                    marginTop: 1
                                },
                                children: "Prêmio extra para quem acertar a seleção campeã"
                            })]
                        })]
                    }), i.jsxs("div", {
                        style: {
                            textAlign: "center",
                            background: H(o.gold, 10),
                            border: `1px solid ${H(o.gold, 30)}`,
                            borderRadius: 14,
                            padding: "14px 10px",
                            marginBottom: 16
                        },
                        children: [i.jsx("div", {
                            style: {
                                fontSize: 10,
                                letterSpacing: 3,
                                color: o.gold,
                                fontWeight: 700,
                                marginBottom: 2
                            },
                            children: "PRÊMIO"
                        }), i.jsxs("div", {
                            style: {
                                fontFamily: "'Barlow Condensed',sans-serif",
                                fontSize: 58,
                                fontWeight: 900,
                                color: o.gold,
                                lineHeight: .95,
                                textShadow: `0 2px 18px ${H(o.gold, 45)}`
                            },
                            children: ["R$ 1.000", i.jsx("span", {
                                style: {
                                    fontSize: 26
                                },
                                children: ",00"
                            })]
                        })]
                    }), i.jsx("div", {
                        style: {
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: 1,
                            color: o.accent,
                            textTransform: "uppercase",
                            marginBottom: 8
                        },
                        children: "Como funciona"
                    }), i.jsxs("div", {
                        style: {
                            fontSize: 13,
                            color: o.textMid,
                            lineHeight: 1.9,
                            marginBottom: 12
                        },
                        children: ["• A janela abre ", i.jsx("strong", {
                            style: {
                                color: "#eaf1fb"
                            },
                            children: "após as oitavas de final"
                        }), " e fecha ", i.jsx("strong", {
                            style: {
                                color: "#eaf1fb"
                            },
                            children: "1 dia antes das quartas"
                        }), ".", i.jsx("br", {}), "• Você escolhe entre os ", i.jsx("strong", {
                            style: {
                                color: "#eaf1fb"
                            },
                            children: "8 classificados às quartas de final"
                        }), ".", i.jsx("br", {}), "• Cada participante poderá escolher apenas ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "uma"
                        }), " seleção campeã.", i.jsx("br", {}), "• O prêmio será ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "dividido igualmente"
                        }), " entre todos que acertarem.", i.jsx("br", {}), "• Esse palpite ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "não soma pontos"
                        }), " no ranking da Fase de Grupos nem no Ranking Geral."]
                    }), i.jsxs("div", {
                        style: {
                            background: o.surface,
                            borderRadius: 10,
                            padding: 12,
                            fontSize: 12,
                            color: o.textMid,
                            lineHeight: 1.6,
                            marginBottom: 10
                        },
                        children: [i.jsx("strong", {
                            style: {
                                color: o.textMid
                            },
                            children: "Exemplo:"
                        }), " se 4 participantes acertarem a seleção campeã, cada um recebe ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "R$ 250,00"
                        }), "."]
                    }), i.jsx("div", {
                        style: {
                            fontSize: 11.5,
                            color: o.textDim,
                            lineHeight: 1.6
                        },
                        children: "⚠️ Caso ninguém acerte a seleção campeã, o prêmio não será distribuído nesta categoria."
                    }), i.jsxs("div", {
                        style: {
                            marginTop: 16,
                            paddingTop: 16,
                            borderTop: `1px solid ${H(o.gold, 25)}`
                        },
                        children: [i.jsx("div", {
                            style: {
                                fontFamily: "'Barlow Condensed',sans-serif",
                                fontSize: 18,
                                fontWeight: 800,
                                letterSpacing: 1,
                                marginBottom: 10
                            },
                            children: "⭐ ESCOLHA SUA CAMPEÃ"
                        }), QA === "bloqueada" && i.jsxs("div", {
                            style: {
                                background: o.surface,
                                border: `1px dashed ${o.border}`,
                                borderRadius: 12,
                                padding: 18,
                                textAlign: "center"
                            },
                            children: [i.jsx("div", {
                                style: {
                                    fontSize: 30,
                                    marginBottom: 8,
                                    opacity: .85
                                },
                                children: "🔒"
                            }), i.jsx("div", {
                                style: {
                                    fontWeight: 700,
                                    fontSize: 14,
                                    marginBottom: 4
                                },
                                children: "Palpite do Campeão ainda bloqueado"
                            }), i.jsx("div", {
                                style: {
                                    fontSize: 12.5,
                                    color: o.textMid
                                },
                                children: "A votação abre após as oitavas de final e fecha 1 dia antes das quartas."
                            })]
                        }), QA === "aberta" && i.jsxs(i.Fragment, {
                            children: [i.jsx("div", {
                                style: {
                                    fontSize: 12.5,
                                    color: NA ? o.green : o.textMid,
                                    marginBottom: 12,
                                    lineHeight: 1.6
                                },
                                children: NA ? i.jsxs(i.Fragment, {
                                    children: ["✓ Seu palpite para campeão foi confirmado: ", i.jsxs("strong", {
                                        style: {
                                            color: o.text
                                        },
                                        children: [i.jsx(rA, {
                                            t: NA,
                                            h: 12
                                        }), " ", NA]
                                    }), ". Você poderá alterar até o fechamento da janela."]
                                }) : i.jsx(i.Fragment, {
                                    children: "Escolha quem você acredita que será a seleção campeã da Copa. Você pode alterar sua escolha até o fechamento da janela."
                                })
                            }), No.length === 0 ? i.jsx("div", {
                                style: {
                                    fontSize: 12.5,
                                    color: o.textMid,
                                    textAlign: "center",
                                    padding: 12
                                },
                                children: "As seleções classificadas ainda serão cadastradas. Volte em breve."
                            }) : i.jsxs(i.Fragment, {
                                children: [i.jsx("div", {
                                    style: {
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))",
                                        gap: 8
                                    },
                                    children: No.map(d => {
                                        const j = x === d;
                                        return i.jsxs("button", {
                                            onClick: () => {
                                                b(d),
                                                k(null)
                                            }
                                            ,
                                            style: {
                                                cursor: "pointer",
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                gap: 6,
                                                padding: "12px 6px",
                                                borderRadius: 12,
                                                position: "relative",
                                                transition: "all .15s",
                                                background: j ? H(o.gold, 14) : o.surface,
                                                border: `2px solid ${j ? o.gold : o.border}`,
                                                boxShadow: j ? `0 0 0 1px ${H(o.gold, 30)}, 0 6px 18px -8px ${H(o.gold, 60)}` : "none"
                                            },
                                            children: [j && i.jsx("span", {
                                                style: {
                                                    position: "absolute",
                                                    top: 4,
                                                    right: 6,
                                                    fontSize: 13
                                                },
                                                children: "✅"
                                            }), i.jsx(rA, {
                                                t: d,
                                                h: 30
                                            }), i.jsx("span", {
                                                style: {
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    color: j ? o.gold : o.text,
                                                    textAlign: "center",
                                                    lineHeight: 1.1
                                                },
                                                children: d
                                            })]
                                        }, d)
                                    }
                                    )
                                }), O && i.jsx("div", {
                                    style: {
                                        fontSize: 12,
                                        marginTop: 10,
                                        color: O.tipo === "ok" ? o.green : o.error
                                    },
                                    children: O.txt
                                }), i.jsx("button", {
                                    onClick: () => yc(x),
                                    disabled: !x || x === NA,
                                    style: {
                                        width: "100%",
                                        padding: "13px",
                                        fontSize: 15,
                                        marginTop: 12,
                                        border: "none",
                                        borderRadius: 10,
                                        fontWeight: 800,
                                        letterSpacing: .5,
                                        background: !x || x === NA ? o.surface : o.gold,
                                        color: !x || x === NA ? o.textDim : "#0a1726",
                                        cursor: !x || x === NA ? "default" : "pointer"
                                    },
                                    children: NA ? x === NA ? "✓ Campeão confirmado" : `Alterar para ${x}` : x ? `Confirmar ${x}` : "Selecione uma seleção"
                                })]
                            })]
                        }), QA === "encerrada" && i.jsxs("div", {
                            style: {
                                background: o.surface,
                                border: `1px solid ${o.border}`,
                                borderRadius: 12,
                                padding: 18,
                                textAlign: "center"
                            },
                            children: [i.jsx("div", {
                                style: {
                                    fontSize: 30,
                                    marginBottom: 8
                                },
                                children: NA ? "🤞" : "⏳"
                            }), i.jsx("div", {
                                style: {
                                    fontWeight: 700,
                                    fontSize: 14,
                                    marginBottom: 4
                                },
                                children: "Janela de palpite encerrada"
                            }), i.jsx("div", {
                                style: {
                                    fontSize: 12.5,
                                    color: o.textMid,
                                    marginBottom: NA ? 10 : 0
                                },
                                children: "Agora é só torcer."
                            }), NA && i.jsxs("div", {
                                style: {
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 8,
                                    background: H(o.gold, 12),
                                    borderRadius: 20,
                                    padding: "8px 16px",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: o.gold
                                },
                                children: ["Seu palpite: ", i.jsx(rA, {
                                    t: NA,
                                    h: 14
                                }), " ", NA, J && i.jsx("span", {
                                    style: {
                                        color: NA === J ? o.green : o.textMid,
                                        marginLeft: 4
                                    },
                                    children: NA === J ? "🏆 acertou!" : "❌"
                                })]
                            })]
                        })]
                    })]
                })]
            }), U === "regras" && i.jsxs("div", {
                children: [a.trim() && i.jsxs("div", {
                    style: z.card({
                        marginBottom: 12
                    }),
                    children: [i.jsx("div", {
                        style: {
                            fontFamily: "'Barlow Condensed',sans-serif",
                            fontSize: 22,
                            fontWeight: 800,
                            letterSpacing: 1,
                            marginBottom: 12
                        },
                        children: "📌 REGRAS DO BOLÃO"
                    }), i.jsx("div", {
                        style: {
                            fontSize: 14,
                            color: o.textMid,
                            lineHeight: 1.7,
                            whiteSpace: "pre-wrap"
                        },
                        children: a
                    })]
                }), i.jsxs("div", {
                    style: z.card({
                        marginBottom: 12
                    }),
                    children: [i.jsx("div", {
                        style: {
                            fontFamily: "'Barlow Condensed',sans-serif",
                            fontSize: 22,
                            fontWeight: 800,
                            letterSpacing: 1,
                            marginBottom: 16
                        },
                        children: "📊 PONTUAÇÃO"
                    }), [{
                        fase: "⚽ FASE DE GRUPOS",
                        linhas: [[o.gold, "⭐", `+${cl} pts`, "Placar Exato", "Acertou o placar completo do jogo."], [o.win, "✅", `+${fl} pts`, "Resultado Correto", "Acertou o vencedor do jogo ou o empate, sem acertar o placar exato."], [o.textDim, "❌", "0 pts", "Errou", "Não acertou nem o resultado."]]
                    }, {
                        fase: "⚡ FASES ELIMINATÓRIAS",
                        linhas: [[o.gold, "⭐", `+${$a} pts`, "Placar Exato", "Acertou o placar completo do jogo considerando apenas os 90 minutos."], [o.win, "✅", `+${Ao} pts`, "Resultado Correto", "Acertou o vencedor nos 90 minutos ou o empate, sem acertar o placar exato."], [o.textDim, "❌", "0 pts", "Errou", "Não acertou nem o resultado dos 90 minutos."]]
                    }].map(d => i.jsxs("div", {
                        style: {
                            marginBottom: 18
                        },
                        children: [i.jsx("div", {
                            style: {
                                fontSize: 12,
                                fontWeight: 800,
                                letterSpacing: 1,
                                color: o.accent,
                                marginBottom: 12,
                                textTransform: "uppercase"
                            },
                            children: d.fase
                        }), d.linhas.map( ([j,V,W,F,K]) => i.jsxs("div", {
                            style: {
                                display: "flex",
                                gap: 12,
                                marginBottom: 14
                            },
                            children: [i.jsx("div", {
                                style: {
                                    fontSize: 24,
                                    flexShrink: 0
                                },
                                children: V
                            }), i.jsxs("div", {
                                style: {
                                    flex: 1,
                                    minWidth: 0
                                },
                                children: [i.jsxs("div", {
                                    style: {
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: 8
                                    },
                                    children: [i.jsx("span", {
                                        style: {
                                            fontWeight: 700,
                                            fontSize: 14
                                        },
                                        children: F
                                    }), i.jsx("span", {
                                        style: {
                                            fontFamily: "'Barlow Condensed',sans-serif",
                                            fontSize: 22,
                                            fontWeight: 900,
                                            color: j,
                                            whiteSpace: "nowrap"
                                        },
                                        children: W
                                    })]
                                }), i.jsx("div", {
                                    style: {
                                        fontSize: 12,
                                        color: o.textMid,
                                        marginTop: 2,
                                        lineHeight: 1.5
                                    },
                                    children: K
                                })]
                            })]
                        }, F))]
                    }, d.fase)), i.jsxs("div", {
                        style: {
                            background: o.surface,
                            borderRadius: 10,
                            padding: 14
                        },
                        children: [i.jsx("div", {
                            style: {
                                fontSize: 11,
                                fontWeight: 700,
                                color: o.textMid,
                                marginBottom: 8
                            },
                            children: "EXEMPLO (fase de grupos)"
                        }), i.jsxs("div", {
                            style: {
                                fontSize: 12,
                                color: o.textMid,
                                lineHeight: 2
                            },
                            children: ["Jogo real: ", i.jsx("strong", {
                                style: {
                                    color: o.text
                                },
                                children: "Brasil 2×1 Marrocos"
                            }), i.jsx("br", {}), "Palpite ", i.jsx("strong", {
                                style: {
                                    color: o.gold
                                },
                                children: "2×1"
                            }), " → +", cl, " pts ⭐ (placar exato)", i.jsx("br", {}), "Palpite ", i.jsx("strong", {
                                style: {
                                    color: o.win
                                },
                                children: "3×0"
                            }), " → +", fl, " pts ✅ (acertou o vencedor)", i.jsx("br", {}), "Palpite ", i.jsx("strong", {
                                style: {
                                    color: o.error
                                },
                                children: "0×2"
                            }), " → 0 pts ❌"]
                        })]
                    })]
                }), i.jsxs("div", {
                    style: z.card({
                        marginBottom: 12
                    }),
                    children: [i.jsx("div", {
                        style: {
                            fontFamily: "'Barlow Condensed',sans-serif",
                            fontSize: 22,
                            fontWeight: 800,
                            letterSpacing: 1,
                            marginBottom: 6
                        },
                        children: "🗓️ JANELAS DE PALPITE"
                    }), i.jsxs("div", {
                        style: {
                            fontSize: 13,
                            color: o.textMid,
                            marginBottom: 14,
                            lineHeight: 1.7
                        },
                        children: ["Cada fase tem sua própria janela de palpites. Os palpites podem ser alterados livremente até o fechamento da janela da fase.", i.jsx("br", {}), i.jsx("br", {}), "As janelas fecham ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "1 dia antes do início de cada fase"
                        }), ". Depois do fechamento, não será possível incluir, editar, corrigir ou cancelar palpites."]
                    }), gt.map(d => i.jsxs("div", {
                        style: {
                            marginBottom: 10,
                            paddingBottom: 10,
                            borderBottom: `1px solid ${o.border}`
                        },
                        children: [i.jsx("div", {
                            style: {
                                fontWeight: 700,
                                fontSize: 14
                            },
                            children: d.nome
                        }), i.jsxs("div", {
                            style: {
                                fontSize: 12,
                                color: o.accent,
                                marginTop: 2
                            },
                            children: ["→ fecha ", new Date(d.fecha).toLocaleDateString("pt-BR"), " · jogos: ", d.periodo]
                        })]
                    }, d.id)), i.jsxs("div", {
                        style: {
                            marginTop: 4,
                            paddingTop: 10,
                            borderTop: `1px dashed ${H(o.gold, 40)}`
                        },
                        children: [i.jsx("div", {
                            style: {
                                fontWeight: 700,
                                fontSize: 14,
                                color: o.gold
                            },
                            children: "🏆 Palpite do Campeão"
                        }), i.jsxs("div", {
                            style: {
                                fontSize: 12,
                                color: o.textMid,
                                marginTop: 2,
                                lineHeight: 1.6
                            },
                            children: ["Janela própria: ", i.jsx("strong", {
                                style: {
                                    color: o.text
                                },
                                children: "abre após as oitavas de final"
                            }), " e ", i.jsx("strong", {
                                style: {
                                    color: o.text
                                },
                                children: "fecha 1 dia antes das quartas"
                            }), ". Você escolhe o campeão entre os 8 classificados às quartas."]
                        })]
                    })]
                }), i.jsxs("div", {
                    style: z.card({
                        marginBottom: 12
                    }),
                    children: [i.jsx("div", {
                        style: {
                            fontFamily: "'Barlow Condensed',sans-serif",
                            fontSize: 22,
                            fontWeight: 800,
                            letterSpacing: 1,
                            marginBottom: 10
                        },
                        children: "⚡ ELIMINATÓRIAS"
                    }), i.jsxs("div", {
                        style: {
                            fontSize: 13,
                            color: o.textMid,
                            lineHeight: 1.8
                        },
                        children: ["Nas fases eliminatórias, o placar considerado será sempre o resultado dos ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "90 minutos"
                        }), ", também chamado de tempo normal.", i.jsx("br", {}), i.jsx("br", {}), "Prorrogação e pênaltis ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "não contam"
                        }), " para a pontuação."]
                    }), i.jsxs("div", {
                        style: {
                            background: o.surface,
                            borderRadius: 10,
                            padding: 14,
                            marginTop: 12,
                            fontSize: 12,
                            color: o.textMid,
                            lineHeight: 1.7
                        },
                        children: [i.jsx("strong", {
                            style: {
                                color: o.textMid
                            },
                            children: "Exemplo:"
                        }), " se o jogo terminar ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "1×1 nos 90 minutos"
                        }), " e uma seleção vencer nos pênaltis, o resultado válido para o bolão será ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "empate"
                        }), "."]
                    })]
                }), i.jsxs("div", {
                    style: z.card({
                        marginBottom: 12
                    }),
                    children: [i.jsx("div", {
                        style: {
                            fontFamily: "'Barlow Condensed',sans-serif",
                            fontSize: 22,
                            fontWeight: 800,
                            letterSpacing: 1,
                            marginBottom: 10
                        },
                        children: "🔒 ACESSO"
                    }), i.jsxs("div", {
                        style: {
                            fontSize: 13,
                            color: o.textMid,
                            lineHeight: 1.9
                        },
                        children: ["• Login feito com ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "CPF"
                        }), i.jsx("br", {}), "• Cada colaborador poderá participar ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "uma única vez"
                        }), i.jsx("br", {}), "• Os palpites podem ser alterados ", i.jsx("strong", {
                            style: {
                                color: o.accent
                            },
                            children: "até o fechamento da janela da fase"
                        }), i.jsx("br", {}), "• Após o fechamento da janela, os palpites ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "não poderão ser editados"
                        }), i.jsx("br", {}), "• Dúvidas ou problemas: fale com o RH"]
                    })]
                }), i.jsxs("div", {
                    style: z.card(),
                    children: [i.jsx("div", {
                        style: {
                            fontFamily: "'Barlow Condensed',sans-serif",
                            fontSize: 22,
                            fontWeight: 800,
                            letterSpacing: 1,
                            marginBottom: 10
                        },
                        children: "🤝 CRITÉRIO DE DESEMPATE"
                    }), i.jsxs("div", {
                        style: {
                            fontSize: 13,
                            color: o.textMid,
                            lineHeight: 1.8
                        },
                        children: ["Quando dois participantes têm a ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "mesma pontuação"
                        }), ", o desempate segue esta ordem:", i.jsx("br", {}), i.jsx("br", {}), "1️⃣ Mais ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "placares exatos"
                        }), " (acertos cheios)", i.jsx("br", {}), "2️⃣ Mais ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "resultados certos"
                        }), " (acertou o vencedor/empate)", i.jsx("br", {}), i.jsx("br", {}), "Se ainda assim continuarem ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "totalmente empatados"
                        }), ", o prêmio é ", i.jsx("strong", {
                            style: {
                                color: o.text
                            },
                            children: "dividido igualmente"
                        }), " entre eles."]
                    })]
                })]
            }), U === "admin" && Le && Nc()]
        }, U), i.jsx("nav", {
            style: {
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 100,
                background: o.surface,
                borderTop: `1px solid ${o.border}`,
                display: "flex",
                padding: "6px 0 max(10px, env(safe-area-inset-bottom))",
                boxShadow: "0 -8px 24px rgba(0,0,0,0.35)"
            },
            children: Sc.map( ([d,j,V]) => i.jsxs("button", {
                onClick: () => xA(d),
                "aria-label": V,
                "aria-current": U === d ? "page" : void 0,
                style: {
                    flex: 1,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    minHeight: 48,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    padding: "6px 4px",
                    color: U === d ? o.accent : o.textMid,
                    transition: "color 0.15s"
                },
                children: [i.jsx(qe, {
                    name: p1[d] || "home",
                    size: 22,
                    color: U === d ? o.accent : o.textMid
                }), i.jsx("span", {
                    style: {
                        fontSize: 10,
                        fontWeight: U === d ? 700 : 500,
                        letterSpacing: .5
                    },
                    children: V
                }), U === d && i.jsx("div", {
                    style: {
                        width: 16,
                        height: 2,
                        borderRadius: 2,
                        background: o.accent,
                        marginTop: 1
                    }
                })]
            }, d))
        })]
    })
}
di.createRoot(document.getElementById("root")).render(i.jsx(Rc.StrictMode, {
    children: i.jsx(x1, {})
}));
