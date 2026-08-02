import React from "react";
import { cn } from "@/lib/utils";
import { SvgIconProps } from "./svg-icon";

export default function InfoIcon({ className, size }: SvgIconProps<void>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className={cn("", className)}
            height={size ? size * 4 : "100%"}
            width={size ? size * 4 : "100%"}
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={"75%"}
        >
            <title>Need Help?</title>
            <path d="M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm1,15a1,1,0,0,1-2,0V11a1,1,0,0,1,2,0ZM12,8a1.5,1.5,0,1,1,1.5-1.5A1.5,1.5,0,0,1,12,8Z" />
        </svg>
    );
}
