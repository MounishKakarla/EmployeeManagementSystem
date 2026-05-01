import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import useDocumentTitle from '../hooks/useDocumentTitle'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import { Users, Shield, Zap, BarChart3, Lock, Globe, ArrowRight, Sun, Moon, MessageSquare, Server, Database, CalendarDays, Umbrella, Timer } from 'lucide-react'
import logoIcon from '../assets/Tektalis_Icon_Square.png'
import '../styles/landing.css'

const FEATURES = [
  { icon:Users,      title:'Employee Management',   desc:'Full lifecycle management — onboard, update, and offboard with complete audit trails.',  detail:'Create, edit, deactivate employees. Track join dates, departments, roles, skills and history.' },
  { icon:Shield,     title:'Role-Based Access',      desc:'Granular ADMIN, MANAGER, EMPLOYEE roles. Every action secured.',                          detail:'Three-tier permission model with method-level Spring Security @PreAuthorize annotations.' },
  { icon:Zap,        title:'JWT Authentication',     desc:'Stateless, refresh-token-aware authentication. Sessions stay alive, security stays tight.', detail:'Access tokens expire in 15 minutes. Refresh tokens silently renew sessions via HttpOnly cookies.' },
  { icon:BarChart3,  title:'Smart Search & Filters', desc:'Search by name, department, join date, or skills with server-side pagination.',            detail:'Debounced live search, multi-column filtering, and paginated results.' },
  { icon:Lock,       title:'Password Management',    desc:'Self-service password change and admin-triggered reset with automated email delivery.',     detail:'BCrypt-hashed passwords. Admins can force-reset any account.' },
  { icon:Globe,      title:'Email Notifications',    desc:'Branded email templates sent on account creation and password reset events.',               detail:'Thymeleaf-rendered HTML emails with Tektalis branding and inline logo.' },
  { icon:CalendarDays, title:'Attendance Tracking', desc:'Daily check-in/out with auto-ABSENT scheduler, calendar heatmap, and team roster.',         detail:'Scheduled job marks absent employees at 10AM. Weekend/holiday auto-marking via scheduler.' },
  { icon:Umbrella,   title:'Leave Management',       desc:'Multi-type leaves with holiday-aware working day count and manager approval workflow.',     detail:'Annual, Sick, Casual, Unpaid, Maternity, Paternity. Balance tracking per employee per year.' },
  { icon:Timer,      title:'Timesheets',             desc:'Weekly project-hour grid with public holiday locking and submit/approve workflow.',         detail:'Hours on public holidays are forced to 0. Submit all entries for a week in one click.' },
  { icon:MessageSquare, title:'Aura AI Chatbot',     desc:'Ask anything in plain English — Aura queries your DB and visualises results as charts.',   detail:'Powered by Groq LLaMA. Converts natural language to SQL, auto-detects chart types.' },
  { icon:Server,     title:'Spring Boot + FastAPI',  desc:'Dual backend — Spring Boot handles core EMS while FastAPI powers the AI chatbot.',         detail:'Spring Boot 4 with Spring Security. FastAPI as a lightweight AI microservice.' },
  { icon:Database,   title:'PostgreSQL',             desc:'Relational database powering every query — structured, indexed, and production-ready.',     detail:'JPA/Hibernate ORM. Schema introspection lets Aura AI understand your tables at runtime.' },
]

const STATS = [{ value:'3',label:'Role Levels'},{ value:'JWT',label:'Auth Method'},{ value:'100%',label:'REST API'},{ value:'BCrypt',label:'Encrypted'}]
const TECH  = ['Spring Boot 4','Spring Security','JWT (JJWT)','JPA / Hibernate','PostgreSQL','Thymeleaf','React 18','Vite','TanStack Query','React Hook Form','Axios','React Router v6','FastAPI','Groq LLaMA','Apache POI']

function FeatureCard({ f }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div className="flip-card" onClick={()=>setFlipped(v=>!v)} onMouseEnter={()=>setFlipped(true)} onMouseLeave={()=>setFlipped(false)}>
      <div className="flip-card-inner" style={{ transform:flipped?'rotateY(180deg)':'rotateY(0deg)' }}>
        <div className="flip-face flip-front card landing-feature-card">
          <div className="landing-feature-icon"><f.icon size={20} color="var(--accent)"/></div>
          <h3>{f.title}</h3><p>{f.desc}</p>
          <span className="flip-hint">Hover to learn more →</span>
        </div>
        <div className="flip-face flip-back card landing-feature-card">
          <div style={{ marginBottom:12 }}><f.icon size={22} color="rgba(255,255,255,0.9)"/></div>
          <h3 style={{ color:'#fff', marginBottom:10 }}>{f.title}</h3>
          <p style={{ color:'rgba(255,255,255,0.85)', fontSize:13, lineHeight:1.65 }}>{f.detail}</p>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const navigate               = useNavigate()
  useDocumentTitle('Welcome | TekSphere')
  const { theme, toggleTheme } = useTheme()
  const { isAuthenticated, isLoading } = useAuth()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => { const f=()=>setScrolled(window.scrollY>40); window.addEventListener('scroll',f,{passive:true}); return ()=>window.removeEventListener('scroll',f) }, [])
  useEffect(() => { if (!isLoading && isAuthenticated) navigate('/dashboard',{replace:true}) }, [isAuthenticated,isLoading,navigate])
  if (isLoading) return null


  return (
    <div className="landing">
      <nav className={`landing-nav ${scrolled?'scrolled':''}`}>
        <div className="landing-nav-logo" onClick={()=>navigate('/')} style={{ display:'flex', alignItems:'center', gap:8 }}>
          <img src={logoIcon} alt="TekSphere" style={{ height:32, width:32, borderRadius:6, objectFit:'cover', display:'block' }} />
          <span style={{ fontWeight:700, fontSize:16, letterSpacing:'-0.3px' }}>TekSphere</span>
        </div>
        <div className="landing-nav-right">
          <button className="btn-icon" onClick={toggleTheme} title="Toggle theme">{theme==='dark'?<Sun size={15}/>:<Moon size={15}/>}</button>
          <button className="btn btn-primary btn-sm" onClick={()=>navigate(isAuthenticated?'/dashboard':'/login')}>{isAuthenticated?'Dashboard':'Sign In'} <ArrowRight size={14}/></button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-glow landing-hero-glow-center"/>
        <div className="landing-badge"><span className="landing-badge-dot"/> Spring Boot + React · Full Stack EMS</div>
        <h1 className="landing-hero-title">Manage Your<br/><span style={{ color:'var(--accent)' }}>Workforce</span> with<br/>Precision</h1>
        <p className="landing-hero-desc">A complete Employee Management System with attendance tracking, leave management, timesheets, holiday calendar, AI chatbot, and full audit logging.</p>
        <div className="landing-hero-cta">
          <button className="btn btn-primary btn-lg" onClick={()=>navigate(isAuthenticated?'/dashboard':'/login')}>{isAuthenticated?'Go to Dashboard':'Get Started'} <ArrowRight size={16}/></button>
          <a href="#features" className="btn btn-ghost btn-lg">Learn More</a>
        </div>
        <div className="landing-stats">{STATS.map(s=><div key={s.label} className="landing-stat"><div className="landing-stat-value">{s.value}</div><div className="landing-stat-label">{s.label}</div></div>)}</div>
      </section>

      <section id="features" className="landing-features">
        <div className="landing-section-inner">
          <div className="landing-section-header"><div className="landing-eyebrow">CAPABILITIES</div><h2>Everything you need</h2></div>
          <div className="landing-features-grid">{FEATURES.map((f,i)=><FeatureCard key={i} f={f}/>)}</div>
        </div>
      </section>

      <section className="landing-tech">
        <div className="landing-section-inner" style={{ textAlign:'center' }}>
          <h2 className="landing-tech-title">Built on a solid foundation</h2>
          <p className="landing-tech-desc">Production-grade stack with security and scalability in mind</p>
          <div className="landing-tech-tags">{TECH.map(t=><div key={t} className="tag" style={{ padding:'8px 16px', fontSize:13 }}>{t}</div>)}</div>
        </div>
      </section>

      <section className="landing-cta">
        <h2>Ready to manage your team?</h2>
        <p>Sign in with your employee credentials to access the dashboard.</p>
        <button className="btn btn-lg landing-cta-btn" onClick={()=>navigate('/login')}>Sign In Now <ArrowRight size={16}/></button>
      </section>

      <footer className="landing-footer">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <img src={logoIcon} alt="TekSphere" style={{ height:28, width:28, borderRadius:4, objectFit:'cover', display:'block' }} />
          <span style={{ fontWeight:700, fontSize:15 }}>TekSphere</span>
        </div>
        <span className="landing-footer-copy">© {new Date().getFullYear()} TekSphere. Employee Management System.</span>
      </footer>

      <style>{`.flip-card{perspective:1000px;cursor:pointer;height:230px}.flip-card-inner{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .45s cubic-bezier(.4,0,.2,1)}.flip-face{position:absolute;inset:0;width:100%;height:100%;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box}.flip-back{transform:rotateY(180deg);background:var(--accent)!important;border:none!important;justify-content:center}.flip-hint{font-size:11px;color:var(--text-muted);margin-top:auto;padding-top:10px}`}</style>
    </div>
  )
}
