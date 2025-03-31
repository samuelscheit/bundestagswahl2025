import { Ref, RefObject, useImperativeHandle, useMemo } from "react";
import { tv as tvBase, TV, VariantProps } from "tailwind-variants";
export type UseScrollShadowReturn = ReturnType<typeof useScrollShadow>;

export function useDOMRef<T extends HTMLElement = HTMLElement>(ref?: RefObject<T | null> | Ref<T | null>) {
	const domRef = useRef<T>(null as any);

	useImperativeHandle(ref, () => domRef.current as any);

	return domRef;
}

type ReactRef<T> = React.RefObject<T> | React.MutableRefObject<T> | React.Ref<T>;
type As<Props = any> = React.ElementType<Props>;
type PropsOf<T extends As> = React.ComponentPropsWithoutRef<T> & {
	as?: As;
};
type HTMLHeroUIProps<T extends As = "div", OmitKeys extends keyof any = never> = Omit<
	PropsOf<T>,
	"ref" | "color" | "slot" | "size" | "defaultChecked" | "defaultValue" | OmitKeys
> & {
	as?: As;
};

export const mapPropsVariants = <T extends Record<string, any>, K extends keyof T>(
	props: T,
	variantKeys?: K[],
	removeVariantProps = true
): readonly [Omit<T, K> | T, Pick<T, K> | {}] => {
	if (!variantKeys) {
		return [props, {}];
	}

	const picked = variantKeys.reduce((acc, key) => {
		// Only include the key in `picked` if it exists in `props`
		if (key in props) {
			return { ...acc, [key]: props[key] };
		} else {
			return acc;
		}
	}, {});

	if (removeVariantProps) {
		const omitted = Object.keys(props)
			.filter((key) => !variantKeys.includes(key as K))
			.reduce((acc, key) => ({ ...acc, [key]: props[key as keyof T] }), {});

		return [omitted, picked] as [Omit<T, K>, Pick<T, K>];
	} else {
		return [props, picked] as [T, Pick<T, K>];
	}
};

type Merge<M, N> = N extends Record<string, unknown> ? M : Omit<M, keyof N> & N;
interface DOMElement extends Element, HTMLOrSVGElement {}
type DataAttributes = {
	[dataAttr: string]: any;
};
type DOMAttributes<T = DOMElement> = React.AriaAttributes &
	React.DOMAttributes<T> &
	DataAttributes & {
		id?: string;
		role?: React.AriaRole;
		tabIndex?: number;
		style?: React.CSSProperties;
	};
export type PropGetter<P = Record<string, unknown>, R = DOMAttributes> = (
	props?: Merge<DOMAttributes, P>,
	ref?: React.Ref<any>
) => R & React.RefAttributes<any>;

function objectToDeps(obj: any) {
	if (!obj || typeof obj !== "object") {
		return "";
	}

	try {
		return JSON.stringify(obj);
	} catch (e) {
		return "";
	}
}

function capitalize(str: string) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

interface Props extends HTMLHeroUIProps<"div">, Omit<UseDataScrollOverflowProps, "domRef"> {
	/**
	 * Ref to the DOM node.
	 */
	ref?: ReactRef<HTMLElement | null>;
	/**
	 * The shadow size in pixels.
	 * @default 40
	 */
	size?: number;
}

export type UseScrollShadowProps = Props & ScrollShadowVariantProps;

export function useScrollShadow(originalProps: UseScrollShadowProps) {
	const [props, variantProps] = mapPropsVariants(originalProps, scrollShadow.variantKeys);

	const {
		ref,
		as,
		children,
		className,
		style,
		size = 40,
		offset = 0,
		visibility = "auto",
		isEnabled = true,
		onVisibilityChange,
		...otherProps
	} = props;

	const Component = as || "div";

	const domRef = useDOMRef(ref);

	useDataScrollOverflow({
		domRef,
		offset,
		visibility,
		isEnabled,
		onVisibilityChange,
		updateDeps: [children],
		overflowCheck: originalProps.orientation ?? "vertical",
	});

	const styles = useMemo(
		() =>
			scrollShadow({
				...variantProps,
				className,
			}),
		[objectToDeps(variantProps), className]
	);

	const getBaseProps: PropGetter = (props = {}) => ({
		ref: domRef,
		className: styles,
		"data-orientation": originalProps.orientation ?? "vertical",
		style: {
			"--scroll-shadow-size": `${size}px`,
			...style,
			...props.style,
		},
		...otherProps,
		...props,
	});

	return { Component, styles, domRef, children, getBaseProps };
}

const verticalShadow = [
	"data-[top-scroll=true]:[mask-image:linear-gradient(0deg,#000_calc(100%_-_var(--scroll-shadow-size)),transparent)]",
	"data-[bottom-scroll=true]:[mask-image:linear-gradient(180deg,#000_calc(100%_-_var(--scroll-shadow-size)),transparent)]",
	"data-[top-bottom-scroll=true]:[mask-image:linear-gradient(#000,#000,transparent_0,#000_var(--scroll-shadow-size),#000_calc(100%_-_var(--scroll-shadow-size)),transparent)]",
];

const horizontalShadow = [
	"data-[left-scroll=true]:[mask-image:linear-gradient(270deg,#000_calc(100%_-_var(--scroll-shadow-size)),transparent)]",
	"data-[right-scroll=true]:[mask-image:linear-gradient(90deg,#000_calc(100%_-_var(--scroll-shadow-size)),transparent)]",
	"data-[left-right-scroll=true]:[mask-image:linear-gradient(to_right,#000,#000,transparent_0,#000_var(--scroll-shadow-size),#000_calc(100%_-_var(--scroll-shadow-size)),transparent)]",
];

export const tv: TV = (options, config) =>
	tvBase(options, {
		...config,
		twMerge: config?.twMerge ?? true,
		twMergeConfig: {
			...config?.twMergeConfig,
			theme: {
				...config?.twMergeConfig?.theme,
			},
			classGroups: {
				...config?.twMergeConfig?.classGroups,
				shadow: [{ shadow: ["small", "medium", "large"] }],
			},
		},
	});

/**
 * ScrollShadow wrapper **Tailwind Variants** component
 *
 * const classNames = scrollShadow({...})
 *
 * @example
 * <div className={classNames)}>
 *   Lorem ipsum dolor sit amet, consectetur adipiscing elit.
 *   ...
 * </div>
 */
const scrollShadow = tv({
	base: [],
	variants: {
		orientation: {
			vertical: ["overflow-y-auto", ...verticalShadow],
			horizontal: ["overflow-x-auto", ...horizontalShadow],
		},
		hideScrollBar: {
			true: "scrollbar-hide",
			false: "",
		},
	},
	defaultVariants: {
		orientation: "vertical",
		hideScrollBar: false,
	},
});

export type ScrollShadowVariantProps = VariantProps<typeof scrollShadow>;

export { scrollShadow };

export interface ScrollShadowProps extends UseScrollShadowProps {}

const ScrollShadow = (props: ScrollShadowProps) => {
	const { Component, children, getBaseProps } = useScrollShadow(props);

	return <Component {...getBaseProps()}>{children}</Component>;
};

ScrollShadow.displayName = "HeroUI.ScrollShadow";

export default ScrollShadow;

import { useEffect, useRef } from "react";

export type ScrollOverflowVisibility = "auto" | "top" | "bottom" | "left" | "right" | "both" | "none";

export type ScrollOverflowEdgeCheck = "all" | "top" | "bottom" | "left" | "right";

export type ScrollOverflowOrientation = "horizontal" | "vertical";
export type ScrollOverflowCheck = ScrollOverflowOrientation | "both";

export interface UseDataScrollOverflowProps {
	/**
	 * The reference to the DOM element on which we're checking overflow.
	 */
	domRef?: React.RefObject<HTMLElement>;
	/**
	 * Determines the direction of overflow to check.
	 * - "horizontal" will check for overflow on the x-axis.
	 * - "vertical" will check for overflow on the y-axis.
	 * - "both" (default) will check for overflow on both axes.
	 *
	 * @default "both"
	 */
	overflowCheck?: ScrollOverflowCheck;
	/**
	 * Controlled visible state. Passing "auto" will make the shadow visible only when the scroll reaches the edge.
	 * use "left" / "right" for horizontal scroll and "top" / "bottom" for vertical scroll.
	 * @default "auto"
	 */
	visibility?: ScrollOverflowVisibility;
	/**
	 * Enables or disables the overflow checking mechanism.
	 * @default true
	 */
	isEnabled?: boolean;
	/**
	 * Defines a buffer or margin within which we won't treat the scroll as reaching the edge.
	 *
	 * @default 0 - meaning the check will behave exactly at the edge.
	 */
	offset?: number;
	/**
	 * List of dependencies to update the overflow check.
	 */
	updateDeps?: any[];
	/**
	 * Callback to be called when the overflow state changes.
	 *
	 * @param visibility ScrollOverflowVisibility
	 */
	onVisibilityChange?: (overflow: ScrollOverflowVisibility) => void;
}

export function useDataScrollOverflow(props: UseDataScrollOverflowProps = {}) {
	const {
		domRef,
		isEnabled = true,
		overflowCheck = "vertical",
		visibility = "auto",
		offset = 0,
		onVisibilityChange,
		updateDeps = [],
	} = props;

	const visibleRef = useRef<ScrollOverflowVisibility>(visibility);

	useEffect(() => {
		const el = domRef?.current;

		if (!el || !isEnabled) return;

		const setAttributes = (direction: string, hasBefore: boolean, hasAfter: boolean, prefix: string, suffix: string) => {
			if (visibility === "auto") {
				const both = `${prefix}${capitalize(suffix)}Scroll`;

				if (hasBefore && hasAfter) {
					el.dataset[both] = "true";
					el.removeAttribute(`data-${prefix}-scroll`);
					el.removeAttribute(`data-${suffix}-scroll`);
				} else {
					el.dataset[`${prefix}Scroll`] = hasBefore.toString();
					el.dataset[`${suffix}Scroll`] = hasAfter.toString();
					el.removeAttribute(`data-${prefix}-${suffix}-scroll`);
				}
			} else {
				const next = hasBefore && hasAfter ? "both" : hasBefore ? prefix : hasAfter ? suffix : "none";

				if (next !== visibleRef.current) {
					onVisibilityChange?.(next as ScrollOverflowVisibility);
					visibleRef.current = next as ScrollOverflowVisibility;
				}
			}
		};

		const checkOverflow = () => {
			const directions = [
				{ type: "vertical", prefix: "top", suffix: "bottom" },
				{ type: "horizontal", prefix: "left", suffix: "right" },
			];

			const listbox = el.querySelector('ul[data-slot="list"]');

			// in virtualized listbox, el.scrollHeight is the height of the visible listbox
			const scrollHeight = +(listbox?.getAttribute("data-virtual-scroll-height") ?? el.scrollHeight);

			// in virtualized listbox, el.scrollTop is always 0
			const scrollTop = +(listbox?.getAttribute("data-virtual-scroll-top") ?? el.scrollTop);

			for (const { type, prefix, suffix } of directions) {
				if (overflowCheck === type || overflowCheck === "both") {
					const hasBefore = type === "vertical" ? scrollTop > offset : el.scrollLeft > offset;
					const hasAfter =
						type === "vertical"
							? scrollTop + el.clientHeight + offset < scrollHeight
							: el.scrollLeft + el.clientWidth + offset < el.scrollWidth;

					setAttributes(type, hasBefore, hasAfter, prefix, suffix);
				}
			}
		};

		const clearOverflow = () => {
			["top", "bottom", "top-bottom", "left", "right", "left-right"].forEach((attr) => {
				el.removeAttribute(`data-${attr}-scroll`);
			});
		};

		// auto
		el.addEventListener("scroll", checkOverflow, true);
		checkOverflow();

		// controlled
		if (visibility !== "auto") {
			clearOverflow();
			if (visibility === "both") {
				el.dataset.topBottomScroll = String(overflowCheck === "vertical");
				el.dataset.leftRightScroll = String(overflowCheck === "horizontal");
			} else {
				el.dataset.topBottomScroll = "false";
				el.dataset.leftRightScroll = "false";

				["top", "bottom", "left", "right"].forEach((attr) => {
					el.dataset[`${attr}Scroll`] = String(visibility === attr);
				});
			}
		}

		return () => {
			el.removeEventListener("scroll", checkOverflow, true);
			clearOverflow();
		};
	}, [...updateDeps, isEnabled, visibility, overflowCheck, onVisibilityChange, domRef]);
}

export type UseDataScrollOverflowReturn = ReturnType<typeof useDataScrollOverflow>;
