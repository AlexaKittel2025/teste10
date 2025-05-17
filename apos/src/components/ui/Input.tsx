import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, fullWidth = true, icon, className = '', ...props }, ref) => {
    const widthClass = fullWidth ? 'w-full' : '';
    
    return (
      <div className={`mb-4 ${widthClass}`}>
        {label && (
          <label htmlFor={props.id} className="block text-sm font-medium text-gray-300 mb-1">
            {label}
          </label>
        )}
        
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              {icon}
            </div>
          )}
          
          <input
            ref={ref}
            className={`appearance-none rounded-md relative block ${
              widthClass
            } px-3 py-2 ${
              icon ? 'pl-10' : 'pl-3'
            } border border-gray-700 placeholder-gray-500 text-white bg-[#1e1e1e] focus:outline-none focus:ring-[#3bc37a] focus:border-[#3bc37a] focus:z-10 sm:text-sm ${
              error ? 'border-red-500' : ''
            } ${className}`}
            {...props}
          />
        </div>
        
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input'; 