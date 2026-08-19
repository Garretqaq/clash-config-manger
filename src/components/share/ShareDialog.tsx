"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Copy, Check, Loader2, AlertCircle } from "lucide-react"
import { showToast } from "@/components/ui/toast"

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  configId?: string
  configName: string
  configContent: string
}

const EXPIRY_OPTIONS = [
  { value: "1h", label: "1 小时" },
  { value: "1d", label: "1 天" },
  { value: "7d", label: "7 天" },
  { value: "30d", label: "30 天" },
  { value: "never", label: "永久有效" },
]

interface ShareResult {
  shareId: string
  shareUrl: string
  token: string
  expiresAt: string | null
}

export function ShareDialog({ open, onOpenChange, configId, configName, configContent }: ShareDialogProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ShareResult | null>(null)
  const [copied, setCopied] = useState<{ url: boolean; token: boolean }>({ url: false, token: false })
  const [formData, setFormData] = useState({
    title: "",
    expiresIn: "never",
    shareType: "dynamic", // 默认动态分享
  })

  const handleCreateShare = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // 动态分享时传递 configId，静态分享时不传递
          ...(formData.shareType === "dynamic" && configId ? { configId } : {}),
          configName,
          configContent,
          title: formData.title,
          expiresIn: formData.expiresIn,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setResult(data)
        showToast({ title: "分享链接创建成功", variant: "success" })
      } else {
        showToast({ title: "创建失败", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      showToast({ title: "创建失败", description: "网络错误", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (text: string, type: 'url' | 'token') => {
    await navigator.clipboard.writeText(text)
    setCopied({ ...copied, [type]: true })
    showToast({ title: "已复制到剪贴板", variant: "success" })
    setTimeout(() => setCopied({ ...copied, [type]: false }), 2000)
  }

  const handleClose = () => {
    setResult(null)
    setFormData({
      title: "",
      expiresIn: "never",
      shareType: "dynamic",
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>分享配置</DialogTitle>
          <DialogDescription>
            创建一个带访问令牌的配置文件分享链接
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-4">
            {/* Share Type */}
            {configId && (
              <div className="space-y-2">
                <Label>分享类型</Label>
                <Select
                  value={formData.shareType}
                  onValueChange={(value) => setFormData({ ...formData, shareType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dynamic">
                      动态分享（配置更新后自动获取最新内容）
                    </SelectItem>
                    <SelectItem value="static">
                      静态分享（分享时的内容固定不变）
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">标题（可选）</Label>
              <Input
                id="title"
                placeholder="例如：给张三的订阅"
                maxLength={100}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            {/* Expiry */}
            <div className="space-y-2">
              <Label>有效期</Label>
              <Select
                value={formData.expiresIn}
                onValueChange={(value) => setFormData({ ...formData, expiresIn: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Share URL */}
            <div className="space-y-2">
              <Label>分享链接</Label>
              <div className="flex items-center gap-2">
                <Input value={result.shareUrl} readOnly className="font-mono text-sm" />
                <Button size="icon" onClick={() => handleCopy(result.shareUrl, 'url')}>
                  {copied.url ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Token */}
            <div className="space-y-2">
              <Label>访问令牌</Label>
              <div className="flex items-center gap-2">
                <Input value={result.token} readOnly className="font-mono text-sm" />
                <Button size="icon" onClick={() => handleCopy(result.token, 'token')}>
                  {copied.token ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                请妥善保存链接和令牌，分享时需要同时提供
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? "关闭" : "取消"}
          </Button>
          {!result && (
            <Button onClick={handleCreateShare} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建分享链接
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
