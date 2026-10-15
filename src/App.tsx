import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Book, Loan, PublicBook } from './lib/supabase'
import './App.css'

type BookForm = Pick<Book, 'title' | 'author' | 'category' | 'shelf' | 'copies'>

const emptyBook: BookForm = {
  title: '',
  author: '',
  category: '',
  shelf: '',
  copies: 1,
}

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function App() {
  const isAdminRoute = window.location.pathname.startsWith('/admin')
  const [books, setBooks] = useState<PublicBook[]>([])
  const [catalogLoading, setCatalogLoading] = useState(isSupabaseConfigured)
  const [catalogError, setCatalogError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Tümü')
  const [selectedBook, setSelectedBook] = useState<PublicBook | null>(null)
  const [borrowerName, setBorrowerName] = useState('')
  const [borrowMessage, setBorrowMessage] = useState('')
  const [borrowError, setBorrowError] = useState('')
  const [borrowSaving, setBorrowSaving] = useState(false)

  const refreshCatalog = useCallback(async () => {
    if (!supabase) return

    const { data, error } = await supabase.rpc('get_public_catalog')
    if (error) {
      setCatalogError('Kitap listesi şu anda yüklenemiyor. Lütfen biraz sonra tekrar deneyin.')
    } else {
      setCatalogError('')
      setBooks((data ?? []) as PublicBook[])
    }
    setCatalogLoading(false)
  }, [])

  useEffect(() => {
    if (isAdminRoute || !supabase) return

    let active = true
    void supabase.rpc('get_public_catalog').then(({ data, error }) => {
      if (!active) return
      if (error) setCatalogError('Kitap listesi şu anda yüklenemiyor. Lütfen biraz sonra tekrar deneyin.')
      else {
        setCatalogError('')
        setBooks((data ?? []) as PublicBook[])
      }
      setCatalogLoading(false)
    })
    return () => { active = false }
  }, [isAdminRoute])

  const categories = useMemo(
    () => ['Tümü', ...Array.from(new Set(books.map((book) => book.category))).sort((a, b) => a.localeCompare(b, 'tr'))],
    [books],
  )

  const visibleBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr')
    return books.filter((book) => {
      const matchesCategory = category === 'Tümü' || book.category === category
      const matchesQuery = !normalizedQuery || [book.title, book.author, book.category, book.shelf]
        .some((value) => value.toLocaleLowerCase('tr').includes(normalizedQuery))
      return matchesCategory && matchesQuery
    })
  }, [books, category, query])

  const startBorrow = (book: PublicBook) => {
    setSelectedBook(book)
    setBorrowerName('')
    setBorrowMessage('')
    setBorrowError('')
  }

  const submitBorrow = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !selectedBook || borrowSaving) return

    const trimmedName = borrowerName.trim()
    if (!trimmedName || trimmedName.length > 100) {
      setBorrowError('Lütfen adınızı 1-100 karakter arasında girin.')
      return
    }

    setBorrowSaving(true)
    setBorrowError('')
    const { error } = await supabase.rpc('borrow_book', {
      p_book_id: selectedBook.id,
      p_borrower_name: trimmedName,
    })
    setBorrowSaving(false)

    if (error) {
      setBorrowError(error.message.includes('tüm nüshaları')
        ? 'Bu kitabın tüm nüshaları şu anda ödünçte. Lütfen başka bir kitap seçin.'
        : 'Ödünç kaydı oluşturulamadı. Lütfen tekrar deneyin.')
      await refreshCatalog()
      return
    }

    setBorrowMessage('Ödünç kaydınız oluşturuldu. Kitabı alırken görevliye haber verin.')
    await refreshCatalog()
  }

  if (isAdminRoute) {
    return <AdminPage />
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Okul Kütüphanesi ana sayfa">
          <span className="brand-mark" aria-hidden="true">K</span>
          <span>Okul Kütüphanesi</span>
        </a>
        <a className="admin-link" href="/admin">Yönetici girişi <span aria-hidden="true">↗</span></a>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <span className="eyebrow"><span className="status-dot" /> OKUL KÜTÜPHANESİ</span>
            <h1>Bir sonraki<br /><em>hikâyeni</em> bul.</h1>
            <p>Raflardaki kitaplara göz at, okumak istediğini seç ve kendi adınla ödünç kaydı oluştur.</p>
            <a className="text-link" href="#kitaplar">Kitapları keşfet <span aria-hidden="true">↓</span></a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="sun-shape" />
            <div className="book-stack stack-one"><span>ÖYKÜLER</span></div>
            <div className="book-stack stack-two"><span>MERAK</span></div>
            <div className="book-stack stack-three"><span>YOLCULUK</span></div>
            <div className="hero-spark spark-one">✳</div>
            <div className="hero-spark spark-two">✳</div>
            <span className="art-note">oku · keşfet · paylaş</span>
          </div>
        </section>

        <section className="catalog-section" id="kitaplar">
          <div className="section-heading">
            <div>
              <span className="eyebrow muted-eyebrow">KÜTÜPHANEDE</span>
              <h2>Raflarda neler var?</h2>
            </div>
            <span className="book-count">{books.length} kitap</span>
          </div>

          {!isSupabaseConfigured && <Notice kind="warning">Katalog henüz yapılandırılmadı. Yönetici, Supabase bağlantı ayarlarını eklemeli.</Notice>}
          {catalogError && <Notice kind="error">{catalogError}</Notice>}

          <div className="catalog-controls">
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kitap, yazar veya raf ara" aria-label="Kitap, yazar veya raf ara" />
              {query && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="Aramayı temizle">×</button>}
            </label>
            <label className="category-select">
              <span className="sr-only">Kategori</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>

          {catalogLoading ? (
            <div className="empty-state"><span className="loader" />Kitaplar yükleniyor…</div>
          ) : visibleBooks.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">▤</span>
              <strong>{books.length ? 'Aramanıza uygun kitap yok.' : 'Henüz kitap eklenmemiş.'}</strong>
              <span>{books.length ? 'Başka bir kelime veya kategori deneyin.' : 'Kütüphaneci yeni kitapları eklediğinde burada görünecek.'}</span>
            </div>
          ) : (
            <div className="book-grid">
              {visibleBooks.map((book, index) => (
                <article className="book-card" key={book.id}>
                  <div className={`book-cover cover-${index % 5}`} aria-hidden="true">
                    <span className="cover-mark">{book.title.trim().charAt(0).toLocaleUpperCase('tr')}</span>
                    <span className="cover-title">{book.title}</span>
                    <span className="cover-author">{book.author}</span>
                  </div>
                  <div className="book-card-content">
                    <div className="book-meta"><span>{book.category}</span><span>{book.shelf ? `Raf ${book.shelf}` : 'Raf bilgisi sonra eklenecek'}</span></div>
                    <h3>{book.title}</h3>
                    <p className="book-author">{book.author}</p>
                    <div className="book-card-footer">
                      <span className={book.available_copies > 0 ? 'availability available' : 'availability unavailable'}>
                        <span className="availability-dot" />
                        {book.available_copies > 0 ? `${book.available_copies} nüsha müsait` : 'Şu an ödünçte'}
                      </span>
                      <button type="button" className="borrow-button" disabled={book.available_copies < 1 || !isSupabaseConfigured} onClick={() => startBorrow(book)}>
                        Ödünç al <span aria-hidden="true">↗</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="how-section">
          <div><span className="eyebrow muted-eyebrow">ÜÇ KÜÇÜK ADIM</span><h2>Okumaya başlamak çok kolay.</h2></div>
          <div className="steps-grid">
            <Step number="01" title="Kitabını seç" text="Katalogda aradığın kitabı bul ve müsaitliğini kontrol et." />
            <Step number="02" title="Adını yaz" text="Ödünç al düğmesine dokunup kendi adınla kaydını oluştur." />
            <Step number="03" title="Rafından al" text="Kitabı raftan al. İade ettiğinde görevliye haber ver." />
          </div>
        </section>
      </main>

      <footer className="site-footer"><span>Okul Kütüphanesi</span><span>Kitaplar paylaştıkça çoğalır.</span></footer>

      {selectedBook && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedBook(null) }}>
          <section className="borrow-dialog" role="dialog" aria-modal="true" aria-labelledby="borrow-title">
            <button type="button" className="dialog-close" onClick={() => setSelectedBook(null)} aria-label="Pencereyi kapat">×</button>
            {borrowMessage ? (
              <div className="success-state">
                <span className="success-mark" aria-hidden="true">✓</span>
                <span className="eyebrow muted-eyebrow">KAYDIN ALINDI</span>
                <h2 id="borrow-title">İyi okumalar!</h2>
                <p>{borrowMessage}</p>
                <button className="primary-button" onClick={() => setSelectedBook(null)}>Tamam</button>
              </div>
            ) : (
              <>
                <span className="eyebrow muted-eyebrow">ÖDÜNÇ KAYDI</span>
                <h2 id="borrow-title">Bu kitap seninle gelsin.</h2>
                <p className="dialog-book-title">{selectedBook.title} <span>· {selectedBook.author}</span></p>
                <form onSubmit={submitBorrow}>
                  <label className="field-label" htmlFor="borrower-name">Adın</label>
                  <input id="borrower-name" autoFocus autoComplete="name" maxLength={100} value={borrowerName} onChange={(event) => setBorrowerName(event.target.value)} placeholder="Adını yaz" required />
                  <p className="privacy-note">Adın yalnızca kütüphaneci tarafından ödünç kaydında görülür.</p>
                  {borrowError && <p className="form-error" role="alert">{borrowError}</p>}
                  <button className="primary-button" type="submit" disabled={borrowSaving}>{borrowSaving ? 'Kaydediliyor…' : 'Ödünç kaydı oluştur'}</button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [books, setBooks] = useState<Book[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingBookId, setEditingBookId] = useState<string | null>(null)
  const [bookForm, setBookForm] = useState<BookForm>(emptyBook)
  const [bookFilter, setBookFilter] = useState('')

  useEffect(() => {
    if (!supabase) return

    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(data.session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const isAdmin = user?.app_metadata?.role === 'admin'

  const loadAdminData = useCallback(async () => {
    if (!supabase || !isAdmin) return
    const [bookResult, loanResult] = await Promise.all([
      supabase.from('books').select('id,title,author,category,shelf,copies,archived,created_at').order('title'),
      supabase.from('loans').select('id,borrower_name,checked_out_at,book_id,book:books(title,author,shelf)').is('returned_at', null).order('checked_out_at', { ascending: true }),
    ])
    if (bookResult.error || loanResult.error) {
      setDataError('Veriler alınamadı. Admin rolü ve veritabanı kurulumu kontrol edilmeli.')
    } else {
      setDataError('')
      setBooks((bookResult.data ?? []) as Book[])
      setLoans((loanResult.data ?? []) as unknown as Loan[])
    }
    setDataLoading(false)
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin || !supabase) return

    let active = true
    void Promise.all([
      supabase.from('books').select('id,title,author,category,shelf,copies,archived,created_at').order('title'),
      supabase.from('loans').select('id,borrower_name,checked_out_at,book_id,book:books(title,author,shelf)').is('returned_at', null).order('checked_out_at', { ascending: true }),
    ]).then(([bookResult, loanResult]) => {
      if (!active) return
      if (bookResult.error || loanResult.error) {
        setDataError('Veriler alınamadı. Admin rolü ve veritabanı kurulumu kontrol edilmeli.')
      } else {
        setDataError('')
        setBooks((bookResult.data ?? []) as Book[])
        setLoans((loanResult.data ?? []) as unknown as Loan[])
      }
      setDataLoading(false)
    })
    return () => { active = false }
  }, [isAdmin])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setAuthError('Giriş başarısız. E-posta ve şifreyi kontrol edin.')
  }

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut()
    setBooks([])
    setLoans([])
  }

  const resetBookForm = () => {
    setEditingBookId(null)
    setBookForm(emptyBook)
    setFormError('')
  }

  const saveBook = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !isAdmin || saving) return
    setSaving(true)
    setFormError('')
    setNotice('')

    const values = {
      title: bookForm.title.trim(),
      author: bookForm.author.trim(),
      category: bookForm.category.trim(),
      shelf: bookForm.shelf.trim(),
      copies: Number(bookForm.copies),
    }
    const result = editingBookId
      ? await supabase.from('books').update(values).eq('id', editingBookId)
      : await supabase.from('books').insert(values)

    setSaving(false)
    if (result.error) {
      setFormError(result.error.message.includes('Nüsha adedi')
        ? 'Nüsha adedi, halen ödünçteki kitap sayısından az olamaz.'
        : 'Kitap kaydedilemedi. Alanları ve bağlantıyı kontrol edip tekrar deneyin.')
      return
    }

    setNotice(editingBookId ? 'Kitap bilgileri güncellendi.' : 'Kitap kataloğa eklendi.')
    resetBookForm()
    await loadAdminData()
  }

  const editBook = (book: Book) => {
    setEditingBookId(book.id)
    setBookForm({ title: book.title, author: book.author, category: book.category, shelf: book.shelf, copies: book.copies })
    setFormError('')
    document.getElementById('book-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const toggleArchived = async (book: Book) => {
    if (!supabase || !isAdmin) return
    setNotice('')
    const { error } = await supabase.from('books').update({ archived: !book.archived }).eq('id', book.id)
    if (error) setDataError('Kitap katalogdan kaldırılamadı. Lütfen tekrar deneyin.')
    else {
      setNotice(book.archived ? 'Kitap kataloğa geri alındı.' : 'Kitap katalogdan kaldırıldı; ödünç geçmişi korundu.')
      await loadAdminData()
    }
  }

  const markReturned = async (loan: Loan) => {
    if (!supabase || !isAdmin) return
    setNotice('')
    const { error } = await supabase.rpc('return_loan', { p_loan_id: loan.id })
    if (error) setDataError('İade kaydedilemedi. Lütfen tekrar deneyin.')
    else {
      setNotice(`${loan.book.title} iade edildi olarak kaydedildi.`)
      await loadAdminData()
    }
  }

  const visibleAdminBooks = useMemo(() => {
    const normalized = bookFilter.trim().toLocaleLowerCase('tr')
    return books.filter((book) => !normalized || [book.title, book.author, book.category, book.shelf].some((value) => value.toLocaleLowerCase('tr').includes(normalized)))
  }, [books, bookFilter])

  const availableCopies = useMemo(() => books.filter((book) => !book.archived).reduce((total, book) => total + book.copies, 0) - loans.reduce((total, loan) => total + (books.find((book) => book.id === loan.book_id && !book.archived) ? 1 : 0), 0), [books, loans])

  if (!isSupabaseConfigured) {
    return <AdminFrame><Notice kind="warning">Yönetim panelini kullanmak için Supabase bağlantı ayarları eklenmeli.</Notice><a className="back-link" href="/">← Kataloğa dön</a></AdminFrame>
  }

  if (authLoading) return <AdminFrame><div className="empty-state"><span className="loader" />Oturum kontrol ediliyor…</div></AdminFrame>

  if (!user) {
    return (
      <AdminFrame>
        <section className="login-card">
          <span className="eyebrow muted-eyebrow">KÜTÜPHANECİ</span>
          <h1>Yönetici girişi</h1>
          <p>Kitapları ve ödünç kayıtlarını yönetmek için giriş yapın.</p>
          <form onSubmit={handleLogin}>
            <label className="field-label" htmlFor="admin-email">E-posta</label>
            <input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <label className="field-label" htmlFor="admin-password">Şifre</label>
            <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            {authError && <p className="form-error" role="alert">{authError}</p>}
            <button className="primary-button" type="submit">Giriş yap <span aria-hidden="true">↗</span></button>
          </form>
          <a className="back-link" href="/">← Kataloğa dön</a>
        </section>
      </AdminFrame>
    )
  }

  if (!isAdmin) {
    return <AdminFrame><Notice kind="error">Bu hesap yönetici olarak yetkilendirilmemiş.</Notice><button className="secondary-button" onClick={handleSignOut}>Çıkış yap</button></AdminFrame>
  }

  const activeBookCount = books.filter((book) => !book.archived).length

  return (
    <AdminFrame>
      <div className="dashboard-header">
        <div><span className="eyebrow muted-eyebrow">KÜTÜPHANECİ PANELİ</span><h1>Merhaba.</h1><p>Kütüphanenin güncel durumu ve kayıtları.</p></div>
        <button className="secondary-button signout-button" onClick={handleSignOut}>Çıkış yap</button>
      </div>
      {notice && <Notice kind="success">{notice}</Notice>}
      {dataError && <Notice kind="error">{dataError}</Notice>}

      {dataLoading ? <div className="empty-state"><span className="loader" />Kayıtlar yükleniyor…</div> : (
        <>
          <section className="stats-grid" aria-label="Kütüphane istatistikleri">
            <StatCard label="Katalogdaki kitap" value={activeBookCount} detail="farklı kitap" tone="lavender" />
            <StatCard label="Müsait nüsha" value={Math.max(0, availableCopies)} detail="ödünç alınabilir" tone="mint" />
            <StatCard label="Ödünçte" value={loans.length} detail="aktif kayıt" tone="peach" />
          </section>

          <section className="dashboard-panel loans-panel">
            <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">AÇIK KAYITLAR</span><h2>Ödünçteki kitaplar</h2></div><span className="panel-count">{loans.length}</span></div>
            {loans.length === 0 ? <p className="panel-empty">Şu anda açık ödünç kaydı yok.</p> : (
              <div className="table-wrap"><table><thead><tr><th>Kitap</th><th>Ödünç alan</th><th>Alındığı tarih · en eskiler önce</th><th /></tr></thead>
                <tbody>{loans.map((loan) => (
                  <tr key={loan.id}>
                    <td><strong>{loan.book.title}</strong><span className="table-subtitle">{loan.book.author} · Raf {loan.book.shelf}</span></td>
                    <td>{loan.borrower_name}</td>
                    <td>{dateFormatter.format(new Date(loan.checked_out_at))}</td>
                    <td><button className="return-button" onClick={() => void markReturned(loan)}>İade al <span aria-hidden="true">✓</span></button></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </section>

          <div className="admin-columns">
            <section className="dashboard-panel inventory-panel">
              <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">KATALOG</span><h2>Kitaplar</h2></div></div>
              <label className="search-box admin-search"><span aria-hidden="true">⌕</span><input value={bookFilter} onChange={(event) => setBookFilter(event.target.value)} placeholder="Kitap veya yazar ara" aria-label="Kitap veya yazar ara" /></label>
              <div className="inventory-list">
                {visibleAdminBooks.length ? visibleAdminBooks.map((book) => (
                  <article className={`inventory-item ${book.archived ? 'is-archived' : ''}`} key={book.id}>
                    <div className="inventory-book-icon" aria-hidden="true">▤</div>
                    <div className="inventory-book-info"><strong>{book.title}</strong><span>{book.author} · {book.category} · {book.shelf ? `Raf ${book.shelf}` : 'Raf girilmedi'} · {book.copies} nüsha{book.archived ? ' · katalog dışı' : ''}</span></div>
                    <div className="inventory-actions"><button className="icon-button" aria-label={`${book.title} kitabını düzenle`} onClick={() => editBook(book)}>Düzenle</button><button className="icon-button archive-action" onClick={() => void toggleArchived(book)}>{book.archived ? 'Geri al' : 'Kaldır'}</button></div>
                  </article>
                )) : <p className="panel-empty">Kitap bulunamadı.</p>}
              </div>
            </section>

            <section className="dashboard-panel book-form-panel" id="book-form">
              <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">{editingBookId ? 'KİTABI DÜZENLE' : 'YENİ KAYIT'}</span><h2>{editingBookId ? 'Kitap bilgileri' : 'Kitap ekle'}</h2></div>{editingBookId && <button className="text-button" onClick={resetBookForm}>Vazgeç</button>}</div>
              <form className="book-form" onSubmit={saveBook}>
                <label className="field-label" htmlFor="book-title">Kitap adı</label><input id="book-title" maxLength={200} value={bookForm.title} onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })} required />
                <label className="field-label" htmlFor="book-author">Yazar</label><input id="book-author" maxLength={160} value={bookForm.author} onChange={(event) => setBookForm({ ...bookForm, author: event.target.value })} required />
                <div className="form-row"><div><label className="field-label" htmlFor="book-category">Kategori</label><input id="book-category" maxLength={80} value={bookForm.category} onChange={(event) => setBookForm({ ...bookForm, category: event.target.value })} required /></div><div><label className="field-label" htmlFor="book-shelf">Raf <span className="optional-label">(sonra eklenebilir)</span></label><input id="book-shelf" maxLength={80} value={bookForm.shelf} onChange={(event) => setBookForm({ ...bookForm, shelf: event.target.value })} /></div></div>
                <label className="field-label" htmlFor="book-copies">Nüsha sayısı</label><input id="book-copies" type="number" min={1} max={1000} step={1} value={bookForm.copies} onChange={(event) => setBookForm({ ...bookForm, copies: Number(event.target.value) })} required />
                {formError && <p className="form-error" role="alert">{formError}</p>}
                <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Kaydediliyor…' : editingBookId ? 'Değişiklikleri kaydet' : 'Kitabı kataloğa ekle'}</button>
              </form>
            </section>
          </div>
        </>
      )}
    </AdminFrame>
  )
}

function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <div className="admin-shell">
      <header className="topbar admin-topbar"><a className="brand" href="/"><span className="brand-mark" aria-hidden="true">K</span><span>Okul Kütüphanesi</span></a><span className="admin-label">YÖNETİM</span></header>
      <main className="admin-main">{children}</main>
    </div>
  )
}

function Notice({ kind, children }: { kind: 'warning' | 'error' | 'success'; children: ReactNode }) {
  return <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <article className="step-card"><span>{number}</span><h3>{title}</h3><p>{text}</p></article>
}

function StatCard({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return <article className={`stat-card stat-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

export default App
