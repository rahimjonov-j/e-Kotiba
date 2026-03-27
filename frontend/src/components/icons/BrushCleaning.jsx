export function BrushCleaning({ className = "" }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 2v4"/>
      <path d="M8 6h8c1.1 0 2 .9 2 2v2H6V8c0-1.1.9-2 2-2z"/>
      <path d="M5 10l-2 9c-.3 1.2.5 2 1.8 2h14.4c1.3 0 2.1-.8 1.8-2l-2-9"/>
      <path d="M10 14v3"/>
      <path d="M14 14v3"/>
    </svg>
  );
}
