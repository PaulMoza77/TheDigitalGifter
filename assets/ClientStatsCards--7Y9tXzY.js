import{c,j as i}from"./index-BIuwSrfd.js";import{j as e}from"./vendor-query-B0NtJXx3.js";import{C as a}from"./coins-Be7OJfO8.js";/**
 * @license lucide-react v0.552.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o=[["path",{d:"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",key:"169zse"}]],n=c("activity",o);/**
 * @license lucide-react v0.552.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=[["path",{d:"m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z",key:"1fy3hk"}]],d=c("bookmark",l);/**
 * @license lucide-react v0.552.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=[["path",{d:"M12 6v6h4",key:"135r8i"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]],k=c("clock-3",m);function x(t){switch(t){case"coins":return a;case"bookmark":return d;case"activity":return n;case"sparkles":default:return i}}function b({stats:t}){return e.jsx("div",{className:"grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 2xl:grid-cols-4",children:t.map(s=>{const r=x(s.icon);return e.jsxs("div",{className:"rounded-[24px] border border-white/10 bg-zinc-950/70 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur sm:rounded-[28px] sm:p-5",children:[e.jsxs("div",{className:"flex items-start justify-between gap-4",children:[e.jsxs("div",{className:"min-w-0",children:[e.jsx("div",{className:"truncate text-sm font-medium text-zinc-400",children:s.label}),e.jsx("div",{className:"mt-3 text-3xl font-semibold tracking-tight text-white sm:text-3xl",children:s.value})]}),e.jsx("div",{className:"flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white sm:h-11 sm:w-11",children:e.jsx(r,{className:"h-5 w-5"})})]}),e.jsx("div",{className:"mt-4 text-sm text-zinc-500",children:s.helper})]},s.label)})})}export{k as C,b as a};
