import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  isLoading,
  disabled,
  ...props 
}) => {
  const baseStyles = "px-4 py-1.5 rounded-sm font-sans font-semibold text-xs tracking-wide uppercase transition-colors duration-100 border select-none focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:translate-y-px shadow-xs";
  
  const variants = {
    primary: "bg-emerald-700 text-white hover:bg-emerald-800 border-emerald-900 active:bg-emerald-900",
    secondary: "bg-slate-200 text-slate-800 hover:bg-slate-300 border-slate-400 active:bg-slate-400",
    danger: "bg-red-700 text-white hover:bg-red-800 border-red-900 active:bg-red-900",
    outline: "bg-white text-slate-700 hover:bg-slate-100 border-slate-400 active:bg-slate-200"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className} flex items-center justify-center`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : null}
      {children}
    </button>
  );
};