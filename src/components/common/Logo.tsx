import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'icon' | 'full' | 'compact';
  className?: string;
}

export function Logo({ size = 'md', variant = 'icon', className = '' }: LogoProps) {
  const sizeClasses = {
    sm: { container: 'w-6 h-6', icon: 'w-3 h-3' },
    md: { container: 'w-8 h-8', icon: 'w-5 h-5' },
    lg: { container: 'w-12 h-12', icon: 'w-7 h-7' },
    xl: { container: 'w-16 h-16', icon: 'w-10 h-10' }
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-2xl'
  };

  const { container, icon } = sizeClasses[size];
  const textSize = textSizeClasses[size];

  const LogoIcon = () => (
    <div className={`${container} bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center ${className}`}>
      <svg className={`${icon} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    </div>
  );

  if (variant === 'icon') {
    return <LogoIcon />;
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <LogoIcon />
        <div>
          <h1 className={`font-semibold text-gray-900 dark:text-white ${textSize}`}>MetaMind</h1>
          {size !== 'sm' && (
            <p className={`text-xs text-gray-500 dark:text-gray-400 ${size === 'xl' ? 'text-sm' : 'text-xs'}`}>
              AI File Intelligence
            </p>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'full') {
    const logoSizes = {
      sm: { container: 'w-16 h-16', inner: 'w-8 h-8', icon: 'w-5 h-5' },
      md: { container: 'w-24 h-24', inner: 'w-12 h-12', icon: 'w-7 h-7' },
      lg: { container: 'w-32 h-32', inner: 'w-16 h-16', icon: 'w-10 h-10' },
      xl: { container: 'w-40 h-40', inner: 'w-20 h-20', icon: 'w-12 h-12' }
    };

    const titleSizes = {
      sm: 'text-2xl',
      md: 'text-3xl',
      lg: 'text-4xl',
      xl: 'text-5xl'
    };

    const logoSize = logoSizes[size];
    const titleSize = titleSizes[size];

    return (
      <div className={`text-center ${className}`}>
        {/* Large Logo */}
        <div className={`${logoSize.container} mx-auto mb-6 bg-gradient-to-br from-primary-500 to-primary-700 rounded-apple-xl shadow-apple-xl flex items-center justify-center`}>
          <div className={`${logoSize.inner} bg-white/20 rounded-apple-lg backdrop-blur-sm flex items-center justify-center`}>
            <svg
              className={`${logoSize.icon} text-white`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
        </div>

        <h1 className={`${titleSize} font-bold text-gray-900 dark:text-white mb-2`}>
          <span className="bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
            MetaMind
          </span>
        </h1>
        <p className={`${size === 'xl' ? 'text-lg' : 'text-base'} text-gray-600 dark:text-gray-400`}>
          AI-Powered File Intelligence System
        </p>
      </div>
    );
  }

  return <LogoIcon />;
}