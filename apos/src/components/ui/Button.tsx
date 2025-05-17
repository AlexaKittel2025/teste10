import React from 'react';
import Link from 'next/link';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  onClick,
  disabled = false,
  className = '',
  type = 'button',
  fullWidth = false,
  icon,
}: ButtonProps) {
  const baseStyles = 'rounded-md font-medium transition-all flex items-center justify-center';
  
  const variantStyles = {
    primary: 'bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] text-white hover:opacity-90',
    secondary: 'border border-[#3bc37a] text-white hover:bg-[#3bc37a] hover:bg-opacity-10',
    outline: 'border border-gray-600 text-white hover:border-[#3bc37a]',
    text: 'text-white hover:text-[#3bc37a]',
  };
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };
  
  const widthClass = fullWidth ? 'w-full' : '';
  
  const classes = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthClass} ${className}`;
  
  if (href) {
    return (
      <Link href={href} className={classes}>
        {icon && <span className="mr-2">{icon}</span>}
        {children}
      </Link>
    );
  }
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${classes} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
} 