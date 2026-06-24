import Header    from '../../components/layout/Header'
import Footer    from '../../components/layout/Footer'
import TopBanner from '../../components/layout/TopBanner'

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBanner />
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  )
}