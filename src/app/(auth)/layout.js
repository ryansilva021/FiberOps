export default function AuthLayout({ children }) {
  return (
    <div
      style={{ backgroundColor: '#0b1220', minHeight: '100vh' }}
      className="flex items-center justify-center"
    >
      {children}
    </div>
  )
}
