import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// 自定义主题键必须显式登记给 tailwind-merge，否则它按命名猜分组：
// bg-check（自定义的 backgroundImage）会被当成背景色，与 checked:bg-primary 同组合并、
// 丢掉排在前面的那个 —— 表现就是勾选后只剩白勾画在白底上，看着像勾不上。
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'bg-image': ['bg-check'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Shanghai"
  })
}
