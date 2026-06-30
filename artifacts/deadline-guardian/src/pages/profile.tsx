import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-context"
import { useUpdateProfile, useUpdateAvatar } from "@workspace/api-client-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Camera, Save } from "lucide-react"

export default function Profile() {
  const { user, setAuth, token } = useAuth()
  const { toast } = useToast()
  
  const updateProfile = useUpdateProfile()
  const updateAvatar = useUpdateAvatar()

  const [name, setName] = useState(user?.name || "")
  const [timeZone, setTimeZone] = useState(user?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [dailyWorkingHours, setDailyWorkingHours] = useState(user?.dailyWorkingHours?.toString() || "8")
  const [preferredWorkingTime, setPreferredWorkingTime] = useState<"morning" | "afternoon" | "night">(
    (user?.preferredWorkingTime as any) || "morning"
  )
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.notificationsEnabled ?? true)

  const handleSaveProfile = () => {
    updateProfile.mutate({
      data: {
        name,
        timeZone,
        dailyWorkingHours: parseInt(dailyWorkingHours),
        preferredWorkingTime,
        notificationsEnabled
      }
    }, {
      onSuccess: (updatedUser) => {
        if (token) setAuth(updatedUser, token)
        toast({ title: "Profile updated successfully" })
      },
      onError: () => {
        toast({ variant: "destructive", title: "Failed to update profile" })
      }
    })
  }

  // Mock avatar update since we don't have file upload in this mockup
  const handleAvatarClick = () => {
    const dicebearUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${name}&backgroundColor=b6e3f4,c0aede,d1d4f9`
    updateAvatar.mutate({ data: { profilePicture: dicebearUrl } }, {
      onSuccess: (updatedUser) => {
        if (token) setAuth(updatedUser, token)
        toast({ title: "Avatar updated" })
      }
    })
  }

  if (!user) return null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-serif font-bold tracking-tight">Profile & Preferences</h2>
        <p className="text-muted-foreground">Manage your account settings and AI configuration.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your photo and personal details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
                  <AvatarImage src={user.profilePicture || ""} />
                  <AvatarFallback className="text-2xl bg-primary/20 text-primary">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <button 
                  onClick={handleAvatarClick}
                  className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full shadow-sm hover:scale-110 transition-transform"
                  disabled={updateAvatar.isPending}
                >
                  {updateAvatar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </button>
              </div>
              <div className="space-y-1">
                <h3 className="font-medium text-lg">{user.email}</h3>
                <p className="text-sm text-muted-foreground">Member since {new Date(user.createdAt).getFullYear()}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={timeZone} onValueChange={setTimeZone}>
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC (Universal Time)</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time (US)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (US)</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time (US)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time (US)</SelectItem>
                    <SelectItem value="Europe/London">London (UK)</SelectItem>
                    <SelectItem value="Europe/Paris">Paris (France)</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo (Japan)</SelectItem>
                    {/* Add fallback for user's actual timezone if not in list */}
                    {![
                      "UTC", "America/New_York", "America/Chicago", "America/Denver", 
                      "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo"
                    ].includes(timeZone) && (
                      <SelectItem value={timeZone}>{timeZone} (Auto-detected)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work Preferences</CardTitle>
            <CardDescription>Guardian uses these to schedule tasks and suggest breaks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hours">Daily Working Hours Capacity</Label>
                <Input 
                  id="hours" 
                  type="number" 
                  min="1" 
                  max="16" 
                  value={dailyWorkingHours} 
                  onChange={(e) => setDailyWorkingHours(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredTime">Preferred Deep Work Time</Label>
                <Select value={preferredWorkingTime} onValueChange={(v: any) => setPreferredWorkingTime(v)}>
                  <SelectTrigger id="preferredTime">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning (8am - 12pm)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (1pm - 5pm)</SelectItem>
                    <SelectItem value="night">Night Owl (8pm - 12am)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive alerts for imminent deadlines and AI suggestions.</p>
              </div>
              <Switch 
                checked={notificationsEnabled} 
                onCheckedChange={setNotificationsEnabled} 
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end border-t pt-6 bg-muted/20">
            <Button onClick={handleSaveProfile} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Preferences
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
