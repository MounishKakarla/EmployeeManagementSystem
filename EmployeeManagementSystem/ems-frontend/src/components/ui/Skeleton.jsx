// src/components/ui/Skeleton.jsx
export default function Skeleton({ className='', style={}, height, width, borderRadius }) {
  return <div className={`skeleton-loader ${className}`} style={{ ...style, ...(height&&{height}), ...(width&&{width}), ...(borderRadius&&{borderRadius}) }} />
}
