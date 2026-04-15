import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
const COLORS=['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316']
export default function DashboardCharts({ deptData, hireData, isLoading }) {
  if (isLoading) return (
    <div className="grid-2 dashboard-charts-loading">
      {[0,1].map(i=><div key={i} className="card" style={{height:350,display:'flex',alignItems:'center',justifyContent:'center'}}><div className="spinner" style={{width:32,height:32}}/></div>)}
    </div>
  )
  return (
    <div className="grid-2 dashboard-charts">
      <div className="card chart-card">
        <div className="card-header"><h3 className="card-title">Department Distribution</h3></div>
        <div style={{height:300,width:'100%'}}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={deptData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" nameKey="name">
              {deptData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
            </Pie>
            <Tooltip contentStyle={{backgroundColor:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'8px'}} itemStyle={{color:'var(--text-primary)'}}/>
            <Legend verticalAlign="bottom" height={36}/></PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card chart-card">
        <div className="card-header"><h3 className="card-title">Hiring Trends</h3></div>
        <div style={{height:300,width:'100%'}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hireData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)"/>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--text-muted)',fontSize:12}}/>
              <YAxis axisLine={false} tickLine={false} tick={{fill:'var(--text-muted)',fontSize:12}}/>
              <Tooltip cursor={{fill:'var(--bg-tertiary)'}} contentStyle={{backgroundColor:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'8px'}} itemStyle={{color:'var(--accent)'}}/>
              <Bar dataKey="hires" fill="var(--accent)" radius={[4,4,0,0]} barSize={32}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
