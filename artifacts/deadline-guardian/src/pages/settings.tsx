import { useTheme } from "@/components/theme-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Moon, Sun, Monitor } from "lucide-react"

export default function Settings() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-serif font-bold tracking-tight">App Settings</h2>
        <p className="text-muted-foreground">Manage appearance and local behavior.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how Deadline Guardian looks on this device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setTheme("light")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                theme === "light" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted"
              }`}
            >
              <Sun className={`h-8 w-8 mb-2 ${theme === "light" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`font-medium ${theme === "light" ? "text-primary" : "text-muted-foreground"}`}>Light</span>
            </button>

            <button
              onClick={() => setTheme("dark")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                theme === "dark" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted"
              }`}
            >
              <Moon className={`h-8 w-8 mb-2 ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`font-medium ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`}>Dark</span>
            </button>

            <button
              onClick={() => setTheme("system")}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                theme === "system" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted"
              }`}
            >
              <Monitor className={`h-8 w-8 mb-2 ${theme === "system" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`font-medium ${theme === "system" ? "text-primary" : "text-muted-foreground"}`}>System</span>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Behavior</CardTitle>
          <CardDescription>Control how aggressive Guardian is with suggestions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
            <div className="space-y-0.5">
              <Label className="text-base">Proactive Rescheduling</Label>
              <p className="text-sm text-muted-foreground">Allow Guardian to suggest moving low-priority tasks when you're overloaded.</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
            <div className="space-y-0.5">
              <Label className="text-base">Tough Love Mode</Label>
              <p className="text-sm text-muted-foreground">More direct, blunt warnings when you're procrastinating.</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
