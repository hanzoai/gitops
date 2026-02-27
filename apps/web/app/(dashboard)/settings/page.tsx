'use client'

import {
  Bell,
  Globe,
  Key,
  Shield,
  User,
} from 'lucide-react'
import {
  Button,
  Input,
  Separator,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@hanzo/ui/primitives'

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and platform preferences.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-3.5 w-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-3.5 w-3.5" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-3.5 w-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-2">
            <Key className="h-3.5 w-3.5" />
            API Keys
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="max-w-lg space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold">Profile</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Your public profile information.
              </p>
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Name</label>
                  <Input defaultValue="z" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input defaultValue="z@hanzo.ai" disabled />
                  <p className="text-xs text-muted-foreground">
                    Managed by hanzo.id -- sign in to change.
                  </p>
                </div>
              </div>
              <div className="mt-6">
                <Button>Save Changes</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="max-w-lg space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold">Authentication</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Authentication is managed via hanzo.id (SSO).
              </p>
              <div className="mt-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Two-factor authentication</p>
                  <p className="text-xs text-muted-foreground">
                    Add an extra layer of security to your account.
                  </p>
                </div>
                <Switch />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="max-w-lg space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold">Notification Preferences</h3>
              <div className="mt-6 space-y-4">
                {[
                  ['Deployment alerts', 'Get notified when deployments succeed or fail'],
                  ['Cluster health', 'Alerts when cluster resources exceed thresholds'],
                  ['Security events', 'Notifications for authentication and access changes'],
                ].map(([title, desc]) => (
                  <div key={title} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="api-keys">
          <div className="max-w-lg space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold">API Keys</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create API keys for programmatic access to the Hanzo Platform API.
              </p>
              <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center">
                <Key className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">No API keys created yet.</p>
                <Button className="mt-4 gap-2" variant="outline">
                  <Key className="h-4 w-4" />
                  Generate API Key
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
