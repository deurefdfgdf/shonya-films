'use client';

import { Command as CommandPrimitive, useCommandState } from 'cmdk';
import { X } from 'lucide-react';
import * as React from 'react';
import { forwardRef, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface Option {
  value: string;
  label: string;
  disable?: boolean;
  fixed?: boolean;
  [key: string]: string | boolean | undefined;
}

interface GroupOption {
  [key: string]: Option[];
}

interface MultipleSelectorProps {
  value?: Option[];
  defaultOptions?: Option[];
  options?: Option[];
  placeholder?: string;
  loadingIndicator?: React.ReactNode;
  emptyIndicator?: React.ReactNode;
  delay?: number;
  triggerSearchOnFocus?: boolean;
  onSearch?: (value: string) => Promise<Option[]>;
  onSearchSync?: (value: string) => Option[];
  onChange?: (options: Option[]) => void;
  maxSelected?: number;
  onMaxSelected?: (maxLimit: number) => void;
  hidePlaceholderWhenSelected?: boolean;
  disabled?: boolean;
  groupBy?: string;
  className?: string;
  badgeClassName?: string;
  selectFirstItem?: boolean;
  creatable?: boolean;
  commandProps?: React.ComponentPropsWithoutRef<typeof Command>;
  inputProps?: Omit<
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>,
    'value' | 'placeholder' | 'disabled'
  >;
  hideClearAllButton?: boolean;
}

export interface MultipleSelectorRef {
  selectedValue: Option[];
  input: HTMLInputElement;
  focus: () => void;
  reset: () => void;
}

export function useDebounce<T>(value: T, delay?: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay || 500);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function transToGroupOption(options: Option[], groupBy?: string) {
  if (options.length === 0) {
    return {};
  }

  if (!groupBy) {
    return { '': options };
  }

  const groupOption: GroupOption = {};
  options.forEach((option) => {
    const key = (option[groupBy] as string) || '';
    if (!groupOption[key]) {
      groupOption[key] = [];
    }
    groupOption[key].push(option);
  });

  return groupOption;
}

function removePickedOption(groupOption: GroupOption, picked: Option[]) {
  const cloneOption = JSON.parse(JSON.stringify(groupOption)) as GroupOption;

  for (const [key, value] of Object.entries(cloneOption)) {
    cloneOption[key] = value.filter((option) => !picked.find((pickedItem) => pickedItem.value === option.value));
  }

  return cloneOption;
}

function isOptionsExist(groupOption: GroupOption, targetOption: Option[]) {
  for (const [, value] of Object.entries(groupOption)) {
    if (value.some((option) => targetOption.find((pickedItem) => pickedItem.value === option.value))) {
      return true;
    }
  }

  return false;
}

const CommandEmpty = forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof CommandPrimitive.Empty>
>(({ className, ...props }, forwardedRef) => {
  const render = useCommandState((state) => state.filtered.count === 0);

  if (!render) {
    return null;
  }

  return (
    <div
      ref={forwardedRef}
      className={cn('px-3 py-6 text-center text-sm text-[var(--color-text-muted)]', className)}
      cmdk-empty=""
      role="presentation"
      {...props}
    />
  );
});

CommandEmpty.displayName = 'CommandEmpty';

const MultipleSelector = React.forwardRef<MultipleSelectorRef, MultipleSelectorProps>(
  (
    {
      value,
      onChange,
      placeholder,
      defaultOptions: arrayDefaultOptions = [],
      options: arrayOptions,
      delay,
      onSearch,
      onSearchSync,
      loadingIndicator,
      emptyIndicator,
      maxSelected = Number.MAX_SAFE_INTEGER,
      onMaxSelected,
      hidePlaceholderWhenSelected,
      disabled,
      groupBy,
      className,
      badgeClassName,
      selectFirstItem = true,
      creatable = false,
      triggerSearchOnFocus = false,
      commandProps,
      inputProps,
      hideClearAllButton = false,
    }: MultipleSelectorProps,
    ref: React.Ref<MultipleSelectorRef>
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [open, setOpen] = React.useState(false);
    const [onScrollbar, setOnScrollbar] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const [selected, setSelected] = React.useState<Option[]>(value || []);
    const [options, setOptions] = React.useState<GroupOption>(
      transToGroupOption(arrayOptions || arrayDefaultOptions, groupBy)
    );
    const [inputValue, setInputValue] = React.useState('');
    const debouncedSearchTerm = useDebounce(inputValue, delay || 500);

    React.useImperativeHandle(
      ref,
      () => ({
        selectedValue: [...selected],
        input: inputRef.current as HTMLInputElement,
        focus: () => inputRef.current?.focus(),
        reset: () => setSelected([]),
      }),
      [selected]
    );

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        inputRef.current.blur();
      }
    };

    const handleUnselect = React.useCallback(
      (option: Option) => {
        const nextOptions = selected.filter((item) => item.value !== option.value);
        setSelected(nextOptions);
        onChange?.(nextOptions);
      },
      [onChange, selected]
    );

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        const input = inputRef.current;
        if (!input) {
          return;
        }

        if ((event.key === 'Delete' || event.key === 'Backspace') && input.value === '' && selected.length > 0) {
          const lastSelected = selected[selected.length - 1];
          if (!lastSelected.fixed) {
            handleUnselect(lastSelected);
          }
        }

        if (event.key === 'Escape') {
          input.blur();
        }
      },
      [handleUnselect, selected]
    );

    useEffect(() => {
      if (open) {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchend', handleClickOutside);
      } else {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchend', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchend', handleClickOutside);
      };
    }, [open]);

    useEffect(() => {
      setSelected(value || []);
    }, [value]);

    useEffect(() => {
      if (onSearch) {
        return;
      }

      const sourceOptions = arrayOptions || arrayDefaultOptions;
      const nextOptions = transToGroupOption(sourceOptions, groupBy);
      if (JSON.stringify(nextOptions) !== JSON.stringify(options)) {
        setOptions(nextOptions);
      }
    }, [arrayDefaultOptions, arrayOptions, groupBy, onSearch, options]);

    useEffect(() => {
      const doSearchSync = () => {
        const result = onSearchSync?.(debouncedSearchTerm);
        setOptions(transToGroupOption(result || [], groupBy));
      };

      const execute = async () => {
        if (!onSearchSync || !open) {
          return;
        }

        if (triggerSearchOnFocus) {
          doSearchSync();
        }

        if (debouncedSearchTerm) {
          doSearchSync();
        }
      };

      void execute();
    }, [debouncedSearchTerm, groupBy, onSearchSync, open, triggerSearchOnFocus]);

    useEffect(() => {
      const doSearch = async () => {
        setIsLoading(true);
        const result = await onSearch?.(debouncedSearchTerm);
        setOptions(transToGroupOption(result || [], groupBy));
        setIsLoading(false);
      };

      const execute = async () => {
        if (!onSearch || !open) {
          return;
        }

        if (triggerSearchOnFocus) {
          await doSearch();
        }

        if (debouncedSearchTerm) {
          await doSearch();
        }
      };

      void execute();
    }, [debouncedSearchTerm, groupBy, onSearch, open, triggerSearchOnFocus]);

    const CreatableItem = () => {
      if (!creatable) {
        return undefined;
      }

      if (
        isOptionsExist(options, [{ value: inputValue, label: inputValue }]) ||
        selected.find((item) => item.value === inputValue)
      ) {
        return undefined;
      }

      const item = (
        <CommandItem
          value={inputValue}
          className="cursor-pointer px-4 py-3 text-sm"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onSelect={(currentValue: string) => {
            if (selected.length >= maxSelected) {
              onMaxSelected?.(selected.length);
              return;
            }
            setInputValue('');
            const nextOptions = [...selected, { value: currentValue, label: currentValue }];
            setSelected(nextOptions);
            onChange?.(nextOptions);
          }}
        >
          {`Create "${inputValue}"`}
        </CommandItem>
      );

      if (!onSearch && inputValue.length > 0) {
        return item;
      }

      if (onSearch && debouncedSearchTerm.length > 0 && !isLoading) {
        return item;
      }

      return undefined;
    };

    const EmptyItem = React.useCallback(() => {
      if (!emptyIndicator) {
        return undefined;
      }

      if (onSearch && !creatable && Object.keys(options).length === 0) {
        return (
          <CommandItem value="-" disabled>
            {emptyIndicator}
          </CommandItem>
        );
      }

      return <CommandEmpty>{emptyIndicator}</CommandEmpty>;
    }, [creatable, emptyIndicator, onSearch, options]);

    const selectables = React.useMemo(() => removePickedOption(options, selected), [options, selected]);

    const commandFilter = React.useCallback(() => {
      if (commandProps?.filter) {
        return commandProps.filter;
      }

      if (creatable) {
        return (currentValue: string, search: string) =>
          currentValue.toLowerCase().includes(search.toLowerCase()) ? 1 : -1;
      }

      return undefined;
    }, [commandProps?.filter, creatable]);

    return (
      <Command
        ref={dropdownRef}
        {...commandProps}
        onKeyDown={(event) => {
          handleKeyDown(event);
          commandProps?.onKeyDown?.(event);
        }}
        className={cn('relative h-auto w-full overflow-visible bg-transparent', commandProps?.className)}
        shouldFilter={commandProps?.shouldFilter !== undefined ? commandProps.shouldFilter : !onSearch}
        filter={commandFilter()}
      >
        <div
          className={cn(
            'w-full min-h-[3.85rem] rounded-[1.35rem] border border-[rgb(255_244_227_/_0.08)] bg-[rgb(255_244_227_/_0.045)] px-4 py-3 text-sm text-[var(--color-text)] transition-[border-color,background-color,transform] duration-300 focus-within:border-[rgb(255_244_227_/_0.22)] focus-within:bg-[rgb(255_244_227_/_0.06)]',
            !disabled && 'cursor-text',
            className
          )}
          onClick={() => {
            if (!disabled) {
              setOpen(true);
              inputRef.current?.focus();
            }
          }}
        >
          <div className="relative flex min-h-[2.2rem] flex-wrap items-center gap-2 pr-8">
            {selected.map((option) => (
              <Badge
                key={option.value}
                className={cn(
                  'max-w-full gap-1.5 rounded-full border border-[rgb(255_244_227_/_0.12)] bg-[rgb(255_244_227_/_0.08)] px-3 py-1.5 text-[0.64rem] font-medium uppercase tracking-[0.18em] text-[var(--color-text)]',
                  badgeClassName
                )}
                data-fixed={option.fixed}
                data-disabled={disabled || undefined}
              >
                <span className="truncate">{option.label}</span>
                <button
                  className={cn(
                    'rounded-full outline-none transition-colors hover:text-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]',
                    (disabled || option.fixed) && 'hidden'
                  )}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleUnselect(option);
                    }
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={() => handleUnselect(option)}
                >
                  <X className="h-3 w-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" />
                </button>
              </Badge>
            ))}

            <CommandPrimitive.Input
              {...inputProps}
              ref={inputRef}
              value={inputValue}
              disabled={disabled}
              onValueChange={(currentValue) => {
                setInputValue(currentValue);
                inputProps?.onValueChange?.(currentValue);
              }}
              onBlur={(event) => {
                if (!onScrollbar) {
                  setOpen(false);
                }
                inputProps?.onBlur?.(event);
              }}
              onFocus={(event) => {
                setOpen(true);
                triggerSearchOnFocus && onSearch?.(debouncedSearchTerm);
                inputProps?.onFocus?.(event);
              }}
              placeholder={hidePlaceholderWhenSelected && selected.length !== 0 ? '' : placeholder}
              className={cn(
                'min-w-[10rem] flex-1 bg-transparent text-[0.96rem] outline-none placeholder:text-[rgb(255_244_227_/_0.34)]',
                selected.length === 0 && 'py-1',
                inputProps?.className
              )}
            />

            <button
              type="button"
              onClick={() => {
                const fixedOptions = selected.filter((item) => item.fixed);
                setSelected(fixedOptions);
                onChange?.(fixedOptions);
              }}
              className={cn(
                'absolute right-0 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[rgb(255_244_227_/_0.08)] hover:text-[var(--color-text)]',
                (hideClearAllButton ||
                  disabled ||
                  selected.length < 1 ||
                  selected.filter((item) => item.fixed).length === selected.length) &&
                  'hidden'
              )}
            >
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative">
          {open ? (
            <CommandList
              className="glass-panel absolute top-3 z-30 w-full overflow-hidden rounded-[1.45rem] border border-[rgb(255_244_227_/_0.1)] p-2 text-[var(--color-text)] shadow-[var(--shadow-soft)] outline-none"
              onMouseLeave={() => setOnScrollbar(false)}
              onMouseEnter={() => setOnScrollbar(true)}
              onMouseUp={() => inputRef.current?.focus()}
            >
              {isLoading ? (
                <div className="px-3 py-6 text-sm text-[var(--color-text-muted)]">{loadingIndicator}</div>
              ) : (
                <>
                  {EmptyItem()}
                  {CreatableItem()}
                  {!selectFirstItem ? <CommandItem value="-" className="hidden" /> : null}
                  {Object.entries(selectables).map(([key, dropdowns]) => (
                    <CommandGroup
                      key={key}
                      heading={key}
                      className="h-full max-h-[min(24rem,52vh)] overflow-auto px-1 [&_[cmdk-group-heading]]:sticky [&_[cmdk-group-heading]]:top-0 [&_[cmdk-group-heading]]:z-10 [&_[cmdk-group-heading]]:rounded-full [&_[cmdk-group-heading]]:bg-[rgb(10_10_10_/_0.9)] [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[0.62rem] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.22em] [&_[cmdk-group-heading]]:text-[var(--color-text-muted)]"
                    >
                      {dropdowns.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={option.label}
                          disabled={option.disable}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onSelect={() => {
                            if (selected.length >= maxSelected) {
                              onMaxSelected?.(selected.length);
                              return;
                            }
                            setInputValue('');
                            const nextOptions = [...selected, option];
                            setSelected(nextOptions);
                            onChange?.(nextOptions);
                          }}
                          className={cn(
                            'cursor-pointer rounded-[1rem] px-4 py-3 text-sm text-[var(--color-text-secondary)] transition-colors data-[selected=true]:bg-[rgb(255_244_227_/_0.08)] data-[selected=true]:text-[var(--color-text)]',
                            option.disable && 'cursor-default text-[var(--color-text-muted)]'
                          )}
                        >
                          {option.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </>
              )}
            </CommandList>
          ) : null}
        </div>
      </Command>
    );
  }
);

MultipleSelector.displayName = 'MultipleSelector';

export { MultipleSelector };

