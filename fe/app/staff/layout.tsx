import StaffSidebar from '../../components/staff/StaffSidebar'

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex' }}>
      <StaffSidebar />
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  )
}