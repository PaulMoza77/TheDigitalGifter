import { Link } from "react-router-dom";

export const Logo = () => (
  <Link
    to="/"
    className="flex items-center gap-3 font-extrabold text-[1.1rem] cursor-pointer select-none"
  >
    <div className="w-8 h-8 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff,#ffe39d_35%,#ffb85b_70%)] shadow-[0_0_12px_rgba(255,195,90,.8)] grid place-items-center text-black text-sm border border-white/60">
      ★
    </div>
    <span className="text-[13px] text-[#fff8e7] drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] sm:text-[1.1rem]">
      The Digital Gifter
    </span>
  </Link>
);
