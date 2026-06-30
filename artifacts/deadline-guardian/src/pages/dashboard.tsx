import { useAuth } from "@/components/auth-context"
import { useGetDashboardSummary, useGetTodayTasks, useGetUpcomingDeadlines, useGetOverdueTasks, useGetWeeklyProgress, useAiDeadlineRisk } from "@workspace/api-client-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Bot, CheckCircle2, Clock, AlertTriangle, Calendar as CalendarIcon, TrendingUp, Flame, AlertCircle } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { format, isToday, isTomorrow, parseISO } from "date-fns"
import { Link } from "wouter"
import { Button } from "@/components/ui/button"
import { TooltipTrigger, TooltipContent } from "@radix-ui/react-tooltip"

export default function Dashboard() {
  const { user } = useAuth()
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary({ query: { enabled: !!user } })
  const { data: todayTasks, isLoading: isTodayLoading } = useGetTodayTasks({ query: { enabled: !!user } })
  const { data: upcomingTasks, isLoading: isUpcomingLoading } = useGetUpcomingDeadlines({ query: { enabled: !!user } })
  const { data: overdueTasks } = useGetOverdueTasks({ query: { enabled: !!user } })
  const { data: weeklyProgress } = useGetWeeklyProgress({ query: { enabled: !!user } })
  const { data: riskAssessments } = useAiDeadlineRisk({ query: { enabled: !!user } })

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }

  const formatDeadline = (dateString: string) => {
    const date = parseISO(dateString)
    if (isToday(date)) return "Today"
    if (isTomorrow(date)) return "Tomorrow"
    return format(date, "MMM d")
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent": return <Badge variant="urgent" className="flex gap-1"><Flame className="h-3 w-3" /> Urgent</Badge>
      case "high": return <Badge variant="high">High</Badge>
      case "medium": return <Badge variant="medium">Medium</Badge>
      case "low": return <Badge variant="low">Low</Badge>
      default: return <Badge variant="outline">{priority}</Badge>
    }
  }

  const getRiskColor = (level: string | undefined | null) => {
    switch (level) {
      case "high": return "text-destructive"
      case "medium": return "text-amber-500"
      case "low": return "text-emerald-500"
      default: return "text-muted-foreground"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-serif font-bold tracking-tight">
            {getGreeting()}, {user?.name.split(" ")[0]}
          </h2>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, MMMM do, yyyy")}
          </p>
        </div>
        
        {summary && (
          <div className="flex items-center gap-4 bg-card px-4 py-2 rounded-lg border shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Productivity Score</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">{summary.productivityScore}</span>
                {summary.productivityScore > 75 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-amber-500 rotate-90" />
                )}
              </div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Streak</span>
              <div className="flex items-center gap-1">
                <Flame className="h-4 w-4 text-amber-500" />
                <span className="text-2xl font-bold">{summary.streak}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Recommendation Strip */}
      {riskAssessments && riskAssessments.length > 0 && (
        <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/20 rounded-xl p-4 flex items-start sm:items-center gap-4 animate-in slide-in-from-bottom-4 fade-in duration-500">
          <div className="bg-background rounded-full p-2 shrink-0 shadow-sm border border-primary/20">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-foreground font-serif">Guardian Suggestion</h4>
            <p className="text-sm text-muted-foreground">
              You have {riskAssessments.filter(r => r.riskLevel === 'high').length} tasks at high risk. I recommend focusing on <strong className="text-foreground">{riskAssessments[0]?.actionRequired || "your most urgent task"}</strong> next.
            </p>
          </div>
          <Button size="sm" asChild className="hidden sm:flex">
             <Link href="/ai">View Plan</Link>
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks Today</CardTitle>
            <CheckSquareIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.completedToday || 0} / {(summary?.completedToday || 0) + (summary?.pendingTasks || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Completed vs Total
            </p>
            <Progress value={summary?.completionRate || 0} className="mt-3" />
          </CardContent>
        </Card>
        
        <Card className="hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <CalendarIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{upcomingTasks?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Due in the next 7 days
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all bg-destructive/5 border-destructive/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summary?.overdueTasks || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires immediate action
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Focus</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.hoursWorkedToday || 0}h</div>
            <p className="text-xs text-muted-foreground mt-1">
              Logged today
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Today's Tasks */}
        <Card className="lg:col-span-4 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <div>
              <CardTitle>Focus Today</CardTitle>
              <CardDescription>Your prioritized tasks for the day</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/tasks">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {isTodayLoading ? (
              <div className="p-6 space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />)}
              </div>
            ) : todayTasks?.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mb-2 text-muted/50" />
                <p>You're all caught up for today!</p>
              </div>
            ) : (
              <div className="divide-y">
                {todayTasks?.map(task => (
                  <div key={task.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: task.category?.color || '#ccc' }} />
                      <div>
                        <h4 className="font-medium font-serif leading-none mb-1 group-hover:text-primary transition-colors">{task.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{task.dueTime || "End of day"}</span>
                          {task.estimatedHours && <span>• {task.estimatedHours}h est.</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       {getPriorityBadge(task.priority)}
                       {task.riskLevel && (
                         <Tooltip>
                           <TooltipTrigger>
                             <AlertCircle className={`h-4 w-4 ${getRiskColor(task.riskLevel)}`} />
                           </TooltipTrigger>
                           <TooltipContent>AI Risk: {task.riskLevel}</TooltipContent>
                         </Tooltip>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Chart & Deadlines */}
        <div className="lg:col-span-3 space-y-6 flex flex-col">
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Weekly Activity</CardTitle>
            </CardHeader>
            <CardContent className="h-[200px]">
              {weeklyProgress && weeklyProgress.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyProgress}>
                    <XAxis 
                      dataKey="day" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} 
                    />
                    <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No data for this week yet
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-base">Approaching</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y">
                {upcomingTasks?.slice(0, 4).map(task => (
                  <div key={task.id} className="p-4 flex items-center justify-between text-sm">
                    <span className="font-medium truncate pr-4">{task.title}</span>
                    <span className="text-muted-foreground whitespace-nowrap">{formatDeadline(task.deadline)}</span>
                  </div>
                ))}
                {(!upcomingTasks || upcomingTasks.length === 0) && (
                   <div className="p-6 text-center text-muted-foreground text-sm">
                     No upcoming deadlines.
                   </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}

function CheckSquareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}
