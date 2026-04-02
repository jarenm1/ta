import { 
  type ReactNode, 
  type ButtonHTMLAttributes, 
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  createContext,
  useContext,
  useState,
  forwardRef 
} from 'react';

// ============================================================================
// CARD COMPONENTS
// ============================================================================

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md';
}

const paddingMap = {
  none: '',
  sm: 'px-4 py-4',
  md: 'px-6 py-6',
  lg: 'px-8 py-8',
};

export function Card({ 
  children, 
  className = '', 
  padding = 'md',
  shadow = 'sm' 
}: CardProps) {
  return (
    <div 
      className={[
        'rounded-2xl border border-neutral-200/80 bg-white/90 backdrop-blur-sm',
        'dark:border-neutral-800/60 dark:bg-neutral-900/40',
        shadow === 'sm' && 'shadow-sm shadow-neutral-200/50 dark:shadow-neutral-900/30',
        shadow === 'md' && 'shadow-md shadow-neutral-200/60 dark:shadow-neutral-900/40',
        paddingMap[padding],
        'transition-all duration-200',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}

export function CardHeader({ 
  children, 
  className = '' 
}: { 
  children: ReactNode; 
  className?: string 
}) {
  return (
    <div className={`mb-6 ${className}`}>
      {children}
    </div>
  );
}

export function CardLabel({ 
  children 
}: { 
  children: ReactNode 
}) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
      {children}
    </p>
  );
}

export function CardTitle({ 
  children,
  className = ''
}: { 
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`mt-2 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-2xl ${className}`}>
      {children}
    </h2>
  );
}

export function CardDescription({ 
  children,
  className = ''
}: { 
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 sm:text-base ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ 
  children, 
  className = '' 
}: { 
  children: ReactNode; 
  className?: string 
}) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

// ============================================================================
// BUTTON COMPONENT
// ============================================================================

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    children, 
    variant = 'secondary', 
    size = 'md', 
    isLoading,
    className = '',
    disabled,
    ...props 
  }, ref) => {
    const baseClasses = [
      'inline-flex items-center justify-center',
      'font-medium transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'active:scale-[0.98]',
    ].join(' ');

    const variantClasses = {
      primary: [
        'rounded-lg bg-neutral-800 text-white',
        'hover:bg-neutral-700',
        'dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white',
      ].join(' '),
      secondary: [
        'rounded-lg border border-neutral-300 bg-white text-neutral-700',
        'hover:border-neutral-400 hover:bg-neutral-50',
        'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300',
        'dark:hover:border-neutral-600 dark:hover:bg-neutral-800',
      ].join(' '),
      ghost: [
        'rounded-lg text-neutral-600',
        'hover:bg-neutral-100 hover:text-neutral-900',
        'dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
      ].join(' '),
      danger: [
        'rounded-lg border border-red-200 bg-red-50 text-red-700',
        'hover:bg-red-100 hover:border-red-300',
        'dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400',
        'dark:hover:bg-red-900/50',
      ].join(' '),
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg 
              className="mr-2 h-4 w-4 animate-spin" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle 
                className="opacity-25" 
                cx="12" cy="12" r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </>
        ) : children}
      </button>
    );
  }
);

Button.displayName = 'Button';

// ============================================================================
// BADGE COMPONENT
// ============================================================================

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'outline' | 'soft';
  size?: 'sm' | 'md';
}

export function Badge({ 
  children, 
  variant = 'default',
  size = 'sm'
}: BadgeProps) {
  const variantClasses = {
    default: [
      'rounded-md bg-neutral-100 text-neutral-700',
      'dark:bg-neutral-800 dark:text-neutral-300',
    ].join(' '),
    outline: [
      'rounded-md border border-neutral-300 bg-transparent text-neutral-700',
      'dark:border-neutral-700 dark:text-neutral-400',
    ].join(' '),
    soft: [
      'rounded-full bg-neutral-100/80 text-neutral-600',
      'dark:bg-neutral-800/50 dark:text-neutral-400',
    ].join(' '),
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs font-medium',
    md: 'px-3 py-1.5 text-sm font-medium',
  };

  return (
    <span className={`${variantClasses[variant]} ${sizeClasses[size]}`}>
      {children}
    </span>
  );
}

// ============================================================================
// INPUT COMPONENT
// ============================================================================

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={[
            'w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5',
            'text-sm text-neutral-900 placeholder:text-neutral-400',
            'transition-all duration-200',
            'focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500/20',
            'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
            'dark:placeholder:text-neutral-500 dark:focus:border-neutral-500',
            error && 'border-red-300 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700',
            className,
          ].filter(Boolean).join(' ')}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// ============================================================================
// TEXTAREA COMPONENT
// ============================================================================

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={[
            'w-full resize-none rounded-xl border border-neutral-300 bg-white px-4 py-3',
            'text-sm leading-6 text-neutral-900 placeholder:text-neutral-400',
            'transition-all duration-200',
            'focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500/20',
            'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
            'dark:placeholder:text-neutral-500 dark:focus:border-neutral-500',
            error && 'border-red-300 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700',
            className,
          ].filter(Boolean).join(' ')}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

// ============================================================================
// SELECT COMPONENT
// ============================================================================

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={[
              'w-full appearance-none rounded-lg border border-neutral-300 bg-white px-4 py-2.5 pr-10',
              'text-sm text-neutral-900',
              'transition-all duration-200',
              'focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500/20',
              'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
              'dark:focus:border-neutral-500',
              error && 'border-red-300 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700',
              className,
            ].filter(Boolean).join(' ')}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 dark:text-neutral-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

// ============================================================================
// TABS COMPONENT
// ============================================================================

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

interface TabsProps {
  children: ReactNode;
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function Tabs({ 
  children, 
  defaultValue, 
  value: controlledValue, 
  onValueChange,
  className = '' 
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  
  const value = controlledValue ?? internalValue;
  const handleValueChange = onValueChange ?? setInternalValue;

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ 
  children, 
  className = '' 
}: { 
  children: ReactNode; 
  className?: string 
}) {
  return (
    <div className={`flex gap-1 border-b border-neutral-200 dark:border-neutral-800 ${className}`}>
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  children: ReactNode;
  value: string;
  className?: string;
}

export function TabsTrigger({ children, value, className = '' }: TabsTriggerProps) {
  const { value: selectedValue, onValueChange } = useTabs();
  const isSelected = selectedValue === value;

  return (
    <button
      className={[
        'relative px-4 py-2 text-sm font-medium transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400',
        isSelected
          ? 'text-neutral-900 dark:text-neutral-100'
          : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
        className,
      ].filter(Boolean).join(' ')}
      onClick={() => onValueChange(value)}
      type="button"
    >
      {children}
      {isSelected && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-800 dark:bg-neutral-200" />
      )}
    </button>
  );
}

interface TabsContentProps {
  children: ReactNode;
  value: string;
  className?: string;
}

export function TabsContent({ children, value, className = '' }: TabsContentProps) {
  const { value: selectedValue } = useTabs();
  
  if (selectedValue !== value) {
    return null;
  }

  return (
    <div className={`animate-fade-in ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// CODE BLOCK COMPONENT
// ============================================================================

interface CodeBlockProps {
  children: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ children, language, className = '' }: CodeBlockProps) {
  return (
    <div className={`group relative ${className}`}>
      <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
        <code>{children}</code>
      </pre>
      {language && (
        <span className="absolute right-2 top-2 text-xs font-medium text-neutral-400 dark:text-neutral-600">
          {language}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface StatCardProps {
  label: string;
  value: ReactNode;
  subvalue?: string;
  className?: string;
}

export function StatCard({ label, value, subvalue, className = '' }: StatCardProps) {
  return (
    <div className={`rounded-xl border border-neutral-200 bg-neutral-50/50 px-5 py-5 dark:border-neutral-800 dark:bg-neutral-900/30 ${className}`}>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
        {value}
      </p>
      {subvalue && (
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{subvalue}</p>
      )}
    </div>
  );
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

export function EmptyState({ 
  title, 
  description,
  action,
}: { 
  title: string; 
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/30 py-12 text-center dark:border-neutral-700 dark:bg-neutral-900/20">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <svg 
          className="h-6 w-6 text-neutral-400 dark:text-neutral-500" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" 
          />
        </svg>
      </div>
      <h3 className="mt-5 text-base font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
      </h3>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ============================================================================
// SKELETON COMPONENT
// ============================================================================

export function Skeleton({ 
  className = '' 
}: { 
  className?: string 
}) {
  return (
    <div 
      className={`animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800 ${className}`}
    />
  );
}
