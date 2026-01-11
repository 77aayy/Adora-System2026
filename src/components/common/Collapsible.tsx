/**
 * Collapsible Component
 * Progressive Disclosure pattern for advanced options
 * Adora Hotel Management System
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleProps {
    trigger: string | React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
    className?: string;
    triggerClassName?: string;
    contentClassName?: string;
    icon?: React.ReactNode;
}

/**
 * Collapsible section for progressive disclosure
 * 
 * @example
 * ```typescript
 * <Collapsible trigger="خيارات متقدمة">
 *   <input type="date" placeholder="تاريخ الجدولة" />
 *   <input type="text" placeholder="ملاحظات" />
 * </Collapsible>
 * ```
 */
export const Collapsible: React.FC<CollapsibleProps> = ({
    trigger,
    children,
    defaultOpen = false,
    className = '',
    triggerClassName = '',
    contentClassName = '',
    icon,
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [height, setHeight] = useState<number | undefined>(defaultOpen ? undefined : 0);
    const contentRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (!contentRef.current) return;
        
        if (isOpen) {
            const scrollHeight = contentRef.current.scrollHeight;
            setHeight(scrollHeight);
            
            // After animation, set to auto for dynamic content
            const timer = setTimeout(() => {
                setHeight(undefined);
            }, 300);
            
            return () => clearTimeout(timer);
        } else {
            setHeight(contentRef.current.scrollHeight);
            // Force reflow
            requestAnimationFrame(() => {
                setHeight(0);
            });
            return undefined;
        }
    }, [isOpen]);
    
    return (
        <div className={`collapsible ${className}`}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between gap-2
                    px-4 py-3 rounded-xl
                    bg-white/5 hover:bg-white/10
                    border border-white/10
                    text-white/80 hover:text-white
                    transition-all duration-200
                    ${triggerClassName}
                `}
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-sm font-medium">{trigger}</span>
                </div>
                
                <ChevronDown
                    className={`
                        w-4 h-4 transition-transform duration-300
                        ${isOpen ? 'rotate-180' : 'rotate-0'}
                    `}
                />
            </button>
            
            {/* Collapsible Content */}
            <div
                ref={contentRef}
                style={{ height }}
                className={`
                    overflow-hidden
                    transition-all duration-300 ease-in-out
                `}
            >
                <div className={`pt-4 ${contentClassName}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

/**
 * Accordion Component (Multiple Collapsibles)
 * Only one section open at a time
 * 
 * @example
 * ```typescript
 * <Accordion>
 *   <AccordionItem title="القسم الأول">
 *     محتوى القسم الأول
 *   </AccordionItem>
 *   <AccordionItem title="القسم الثاني">
 *     محتوى القسم الثاني
 *   </AccordionItem>
 * </Accordion>
 * ```
 */
interface AccordionProps {
    children: React.ReactElement<AccordionItemProps>[];
    defaultOpenIndex?: number;
    className?: string;
}

interface AccordionItemProps {
    title: string | React.ReactNode;
    children: React.ReactNode;
    icon?: React.ReactNode;
}

export const Accordion: React.FC<AccordionProps> = ({
    children,
    defaultOpenIndex = -1,
    className = '',
}) => {
    const [openIndex, setOpenIndex] = useState(defaultOpenIndex);
    
    return (
        <div className={`accordion space-y-2 ${className}`}>
            {React.Children.map(children, (child, index) => {
                if (!React.isValidElement(child)) return null;
                
                return React.cloneElement(child, {
                    ...child.props,
                    isOpen: openIndex === index,
                    onToggle: () => setOpenIndex(openIndex === index ? -1 : index),
                } as any);
            })}
        </div>
    );
};

export const AccordionItem: React.FC<AccordionItemProps & {
    isOpen?: boolean;
    onToggle?: () => void;
}> = ({
    title,
    children,
    icon,
    isOpen = false,
    onToggle,
}) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | undefined>(isOpen ? undefined : 0);
    
    useEffect(() => {
        if (!contentRef.current) return;
        
        if (isOpen) {
            setHeight(contentRef.current.scrollHeight);
            const timer = setTimeout(() => setHeight(undefined), 300);
            return () => clearTimeout(timer);
        } else {
            setHeight(contentRef.current.scrollHeight);
            requestAnimationFrame(() => setHeight(0));
            return undefined;
        }
    }, [isOpen]);
    
    return (
        <div className="accordion-item">
            <button
                onClick={onToggle}
                className={`
                    w-full flex items-center justify-between gap-2
                    px-4 py-3 rounded-xl
                    transition-all duration-200
                    ${isOpen 
                        ? 'bg-teal-500/20 border-teal-500/30 text-white' 
                        : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white'
                    }
                    border
                `}
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-sm font-medium">{title}</span>
                </div>
                
                <ChevronDown
                    className={`
                        w-4 h-4 transition-transform duration-300
                        ${isOpen ? 'rotate-180' : 'rotate-0'}
                    `}
                />
            </button>
            
            <div
                ref={contentRef}
                style={{ height }}
                className="overflow-hidden transition-all duration-300 ease-in-out"
            >
                <div className="pt-4 px-2">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Collapsible;
