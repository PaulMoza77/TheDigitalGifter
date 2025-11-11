import React from "react";

const baseBtn = "inline-flex items-center justify-center rounded-xl px-5 py-3 font-semibold transition-all duration-200";

export const BtnFestive = ({ 
  children, 
  onClick, 
  href, 
  className = "" 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  href?: string; 
  className?: string; 
}) => {
  const festiveClasses = `${baseBtn} text-white font-medium bg-[linear-gradient(135deg,#e74b3c_0%,#ff6a3a_45%,#1abc9c_100%)] shadow-[0_8px_20px_rgba(26,188,156,.25)] hover:shadow-[0_10px_28px_rgba(231,76,60,.35)] transition-all duration-300 hover:transform hover:scale-105 ${className}`;
  
  if (href) {
    return (
      <a href={href} className={festiveClasses}>
        {children}
      </a>
    );
  }
  
  return (
    <button onClick={onClick} className={festiveClasses}>
      {children}
    </button>
  );
};

export const BtnGhost = ({ 
  children, 
  onClick, 
  href, 
  className = "" 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  href?: string; 
  className?: string; 
}) => {
  const ghostClasses = `${baseBtn} text-white/90 font-medium bg-[#1b232a] border border-white/10 hover:border-white/20 hover:bg-[#212b33] backdrop-blur-sm transition-all duration-300 hover:transform hover:scale-105 ${className}`;
  
  if (href) {
    return (
      <a href={href} className={ghostClasses}>
        {children}
      </a>
    );
  }
  
  return (
    <button onClick={onClick} className={ghostClasses}>
      {children}
    </button>
  );
};

export const BtnSecondary = ({ 
  children, 
  onClick, 
  className = "" 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  className?: string; 
}) => {
  return (
    <button 
      onClick={onClick} 
      className={`${baseBtn} text-white/90 font-medium bg-[#1b232a] border border-white/10 hover:border-white/20 hover:bg-[#212b33] backdrop-blur-sm transition-all duration-300 ${className}`}
    >
      {children}
    </button>
  );
};
