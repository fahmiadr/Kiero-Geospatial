const StreetViewIcon = ({ className, disabled }) => (
    <svg 
        fill="currentColor" 
        viewBox="0 0 20 20" 
        role="img" 
        focusable="false" 
        aria-hidden="true" 
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        {/* Pegman Icon */}
        <path 
            transform="translate(-1.4, -0.8) scale(1.15)"
            d="M7.78158,2.71429 C 7.78158,1.76752 8.5491,1 9.49587,1 c 0.94677,0 1.71428,0.76752 1.71428,1.71429 0,0.94676 -0.76751,1.71428 -1.71428,1.71428 -0.94677,0 -1.71429,-0.76752 -1.71429,-1.71428 z m 3,2.14285 -0.30428,0 c -0.60833,0.27973 -1.32831,0.29181 -1.96286,0 l -0.30429,0 c -0.71009,0 -1.28571,0.57563 -1.28571,1.28572 l 0,2.78571 c 0,0.35505 0.28781,0.64286 0.64286,0.64286 l 0.42857,0 0,2.78571 C 7.99587,12.71219 8.28368,13 8.63873,13 l 1.71428,0 c 0.35505,0 0.64286,-0.28781 0.64286,-0.64286 l 0,-2.78571 0.42857,0 c 0.35504,0 0.64286,-0.28781 0.64286,-0.64286 l 0,-2.78571 c 0,-0.71009 -0.57563,-1.28572 -1.28572,-1.28572 z" 
        />
        
        {/* Arrow Right */}
        <path 
            d="M3 16.5h14M14 13.5l3 3-3 3" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
        />

        {/* Diagonal Line for Disabled State */}
        {disabled && (
            <line 
                x1="4" y1="4" x2="16" y2="16" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round"
            />
        )}
    </svg>
);

export default StreetViewIcon;
