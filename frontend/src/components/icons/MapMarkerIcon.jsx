const MapMarkerIcon = (props) => (
    <svg 
        viewBox="0 0 24 24"
        width="50" 
        height="50" 
        fill="currentColor" 
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <path 
            d="M12 22C12 22 4 14.2203 4 10C4 5.58172 7.58172 2 12 2C16.4183 2 20 5.58172 20 10C20 14.2203 12 22 12 22Z"
        />
        <circle cx="12" cy="10" r="3" fill="white" />
    </svg>
);

export default MapMarkerIcon;