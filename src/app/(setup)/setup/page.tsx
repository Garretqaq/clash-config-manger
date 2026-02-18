"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Database,
  User,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Settings,
  AlertCircle,
  Loader2,
  Server,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Step = 1 | 2 | 3;
type DatabaseType = "sqlite" | "mysql";

interface DbValidation {
  tested: boolean;
  success: boolean;
  error?: string;
  version?: string;
  databaseExists: boolean;
}

interface InitStatus {
  inProgress: boolean;
  currentStep: string;
  error?: string;
  success: boolean;
}

export default function SetupPage() {
  const router = useRouter();
  const [checkingInit, setCheckingInit] = useState(true);
  const [step, setStep] = useState<Step>(1);

  // 数据库类型
  const [databaseType, setDatabaseType] = useState<DatabaseType>("sqlite");

  // 检查系统是否已初始化
  useEffect(() => {
    const checkInitStatus = async () => {
      try {
        const response = await fetch("/api/setup/status");
        const data = await response.json();
        if (data.initialized) {
          // 已初始化，跳转到首页
          router.replace("/nodes");
          return;
        }
      } catch (error) {
        console.error("Failed to check init status:", error);
      } finally {
        setCheckingInit(false);
      }
    };
    checkInitStatus();
  }, [router]);

  // Step 1: 数据库配置（拆分为多个字段）
  const [dbHost, setDbHost] = useState("localhost");
  const [dbPort, setDbPort] = useState("3306");
  const [dbUsername, setDbUsername] = useState("root");
  const [dbPassword, setDbPassword] = useState("");
  const [dbName, setDbName] = useState("clash_config");
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [dbValidation, setDbValidation] = useState<DbValidation>({
    tested: false,
    success: false,
    databaseExists: false,
  });
  const [isTestingDb, setIsTestingDb] = useState(false);

  // Step 2: 管理员配置
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 3: 初始化状态
  const [initStatus, setInitStatus] = useState<InitStatus>({
    inProgress: false,
    currentStep: "",
    success: false,
  });

  // 测试数据库连接
  const testDatabaseConnection = async () => {
    // SQLite 不需要验证，直接通过
    if (databaseType === "sqlite") {
      setDbValidation({
        tested: true,
        success: true,
        version: "SQLite 3",
        databaseExists: true,
      });
      return;
    }

    // MySQL 需要验证
    if (!dbHost.trim() || !dbUsername.trim() || !dbName.trim()) {
      setDbValidation({
        tested: true,
        success: false,
        error: "请填写完整的数据库配置",
        databaseExists: false,
      });
      return;
    }

    setIsTestingDb(true);
    setDbValidation({
      tested: false,
      success: false,
      databaseExists: false,
    });

    try {
      const response = await fetch("/api/setup/validate-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databaseType,
          host: dbHost,
          port: dbPort,
          username: dbUsername,
          password: dbPassword,
          database: dbName,
        }),
      });

      const result = await response.json();

      setDbValidation({
        tested: true,
        success: result.success,
        error: result.error,
        version: result.version,
        databaseExists: result.databaseExists,
      });
    } catch {
      setDbValidation({
        tested: true,
        success: false,
        error: "网络请求失败",
        databaseExists: false,
      });
    } finally {
      setIsTestingDb(false);
    }
  };

  // 验证 Step 2
  const validateStep2 = (): { valid: boolean; error?: string } => {
    if (adminUsername.length < 3) {
      return { valid: false, error: "用户名至少 3 个字符" };
    }
    if (adminPassword.length < 6) {
      return { valid: false, error: "密码至少 6 个字符" };
    }
    if (adminPassword !== confirmPassword) {
      return { valid: false, error: "两次输入的密码不一致" };
    }
    return { valid: true };
  };

  // 执行初始化
  const executeInitialize = async () => {
    setInitStatus({
      inProgress: true,
      currentStep: databaseType === "sqlite" ? "正在初始化 SQLite..." : "正在创建数据库...",
      success: false,
    });

    try {
      const body = databaseType === "sqlite"
        ? {
            databaseType,
            admin: {
              username: adminUsername,
              password: adminPassword,
            },
          }
        : {
            databaseType,
            database: {
              host: dbHost,
              port: dbPort,
              username: dbUsername,
              password: dbPassword,
              database: dbName,
            },
            admin: {
              username: adminUsername,
              password: adminPassword,
            },
          };

      const response = await fetch("/api/setup/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        setInitStatus({
          inProgress: false,
          currentStep: "",
          success: true,
        });
      } else {
        setInitStatus({
          inProgress: false,
          currentStep: "",
          success: false,
          error: result.error || "初始化失败",
        });
      }
    } catch {
      setInitStatus({
        inProgress: false,
        currentStep: "",
        success: false,
        error: "网络请求失败",
      });
    }
  };

  // 进入下一步
  const goToNextStep = () => {
    if (step === 1) {
      // SQLite 不需要验证连接，MySQL 需要验证通过
      if (databaseType === "sqlite" || dbValidation.success) {
        setStep(2);
      }
    } else if (step === 2) {
      const validation = validateStep2();
      if (validation.valid) {
        setStep(3);
      }
    }
  };

  // 返回上一步
  const goToPrevStep = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  // 获取数据库名称
  const getDatabaseName = (): string => {
    return dbName;
  };

  // 重置验证状态
  const resetDbValidation = () => {
    setDbValidation({ tested: false, success: false, databaseExists: false });
  };

  // 渲染步骤指示器
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3].map((s, index) => (
        <div key={s} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              s < step
                ? "bg-primary text-primary-foreground"
                : s === step
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {s < step ? <CheckCircle2 className="w-5 h-5" /> : s}
          </div>
          {index < 2 && (
            <div
              className={`w-16 h-1 mx-2 transition-colors ${
                s < step ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  // 渲染 Step 1: 数据库配置
  const renderStep1 = () => (
    <div className="space-y-4">
      {/* 数据库类型选择 */}
      <div className="space-y-2">
        <Label>数据库类型</Label>
        <Select
          value={databaseType}
          onValueChange={(value) => {
            setDatabaseType(value as DatabaseType);
            resetDbValidation();
          }}
        >
          <SelectTrigger className="bg-background/50">
            <SelectValue placeholder="选择数据库类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sqlite">
              <div className="flex items-center">
                <Database className="mr-2 h-4 w-4" />
                SQLite (轻量级，无需配置)
              </div>
            </SelectItem>
            <SelectItem value="mysql">
              <div className="flex items-center">
                <Server className="mr-2 h-4 w-4" />
                MySQL (需要 MySQL 服务器)
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* SQLite 信息提示 */}
      {databaseType === "sqlite" && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-start">
            <Database className="w-5 h-5 mr-3 mt-0.5 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-green-600 dark:text-green-400">使用 SQLite 数据库</p>
              <p className="text-sm text-muted-foreground mt-1">
                数据将保存在 <code className="font-mono px-1 bg-muted rounded">data/clash.db</code> 文件中。SQLite 是一种轻量级数据库，无需额外配置。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MySQL 配置字段 */}
      {databaseType === "mysql" && (
        <>
          {/* 主机和端口 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="dbHost">主机地址</Label>
              <div className="relative">
                <Server className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dbHost"
                  placeholder="localhost"
                  value={dbHost}
                  onChange={(e) => {
                    setDbHost(e.target.value);
                    resetDbValidation();
                  }}
                  className="pl-9 bg-background/50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dbPort">端口</Label>
              <Input
                id="dbPort"
                placeholder="3306"
                value={dbPort}
                onChange={(e) => {
                  setDbPort(e.target.value);
                  resetDbValidation();
                }}
                className="bg-background/50"
              />
            </div>
          </div>

          {/* 用户名和密码 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="dbUsername">用户名</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dbUsername"
                  placeholder="root"
                  value={dbUsername}
                  onChange={(e) => {
                    setDbUsername(e.target.value);
                    resetDbValidation();
                  }}
                  className="pl-9 bg-background/50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dbPassword">密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dbPassword"
                  type={showDbPassword ? "text" : "password"}
                  placeholder="数据库密码"
                  value={dbPassword}
                  onChange={(e) => {
                    setDbPassword(e.target.value);
                    resetDbValidation();
                  }}
                  className="pl-9 pr-9 bg-background/50"
                />
                <button
                  type="button"
                  onClick={() => setShowDbPassword(!showDbPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showDbPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 数据库名 */}
          <div className="space-y-2">
            <Label htmlFor="dbName">数据库名称</Label>
            <div className="relative">
              <Database className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="dbName"
                placeholder="clash_config"
                value={dbName}
                onChange={(e) => {
                  setDbName(e.target.value);
                  resetDbValidation();
                }}
                className="pl-9 bg-background/50"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              如果数据库不存在，将在初始化时自动创建
            </p>
          </div>
        </>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={testDatabaseConnection}
        disabled={
          isTestingDb ||
          (databaseType === "mysql" && (!dbHost.trim() || !dbUsername.trim() || !dbName.trim()))
        }
        className="w-full"
      >
        {isTestingDb ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            测试连接中...
          </>
        ) : (
          <>
            <Database className="mr-2 h-4 w-4" />
            {databaseType === "sqlite" ? "确认使用 SQLite" : "测试连接"}
          </>
        )}
      </Button>

      {dbValidation.tested && (
        <div
          className={`p-4 rounded-lg border ${
            dbValidation.success
              ? "bg-green-500/10 border-green-500/20"
              : "bg-destructive/10 border-destructive/20"
          }`}
        >
          {dbValidation.success ? (
            <div className="space-y-2">
              <div className="flex items-center text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                <span className="font-medium">
                  {databaseType === "sqlite" ? "SQLite 可用" : "连接成功"}
                </span>
              </div>
              {databaseType === "mysql" && dbValidation.version && (
                <p className="text-sm text-muted-foreground">
                  MySQL 版本: {dbValidation.version}
                </p>
              )}
              {databaseType === "mysql" && !dbValidation.databaseExists && (
                <div className="flex items-start mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                  <AlertCircle className="w-4 h-4 mr-2 mt-0.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    数据库 <code className="font-mono px-1 bg-muted rounded">{getDatabaseName()}</code> 不存在，将在初始化时自动创建
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start text-destructive">
              <XCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{dbValidation.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // 渲染 Step 2: 管理员配置
  const renderStep2 = () => {
    const validation = validateStep2();

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="adminUsername">管理员用户名</Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="adminUsername"
              placeholder="admin"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              className="pl-9 bg-background/50"
              autoComplete="username"
            />
          </div>
          <p className="text-xs text-muted-foreground">至少 3 个字符</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adminPassword">管理员密码</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="adminPassword"
              type={showPassword ? "text" : "password"}
              placeholder="至少 6 位字符"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="pl-9 pr-9 bg-background/50"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">确认密码</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-9 pr-9 bg-background/50"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {!validation.valid && validation.error && adminUsername && adminPassword && confirmPassword && (
          <div className="flex items-center text-destructive text-sm">
            <XCircle className="w-4 h-4 mr-2" />
            {validation.error}
          </div>
        )}
      </div>
    );
  };

  // 渲染 Step 3: 确认初始化
  const renderStep3 = () => {
    if (initStatus.success) {
      return (
        <div className="space-y-6 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">初始化完成</h3>
            <p className="text-muted-foreground">
              系统配置已保存，现在可以开始使用了
            </p>
          </div>
          <Button
            onClick={() => window.location.href = "/nodes"}
            className="w-full"
            size="lg"
          >
            进入系统
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">配置摘要</h3>

          <div className="space-y-3 p-4 rounded-lg bg-muted/50">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">数据库类型</span>
              <span className="font-medium">
                {databaseType === "sqlite" ? "SQLite" : "MySQL"}
              </span>
            </div>
            {databaseType === "mysql" ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">数据库服务器</span>
                  <span className="font-mono">{dbHost}:{dbPort}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">数据库用户</span>
                  <span className="font-mono">{dbUsername}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">数据库名称</span>
                  <span className="font-mono">{dbName}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">数据文件</span>
                <span className="font-mono">data/clash.db</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">管理员用户名</span>
              <span>{adminUsername}</span>
            </div>
          </div>

          {databaseType === "mysql" && !dbValidation.databaseExists && (
            <div className="flex items-start p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertCircle className="w-4 h-4 mr-2 mt-0.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                将创建数据库: <code className="font-mono px-1 bg-muted rounded">{getDatabaseName()}</code>
              </p>
            </div>
          )}
        </div>

        {initStatus.error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-start text-destructive">
              <XCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{initStatus.error}</span>
            </div>
          </div>
        )}

        <Button
          type="button"
          onClick={executeInitialize}
          disabled={initStatus.inProgress}
          className="w-full"
          size="lg"
        >
          {initStatus.inProgress ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {initStatus.currentStep || "初始化中..."}
            </>
          ) : (
            <>
              <Settings className="mr-2 h-4 w-4" />
              开始初始化
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          初始化将创建数据库表结构并保存配置文件
        </p>
      </div>
    );
  };

  // 步骤标题
  const stepTitles = {
    1: { title: "数据库配置", desc: databaseType === "sqlite" ? "选择 SQLite 数据库" : "配置 MySQL 数据库连接" },
    2: { title: "管理员配置", desc: "设置管理员账号和密码" },
    3: { title: "确认初始化", desc: "检查配置并完成初始化" },
  };

  // 检查初始化状态时显示 loading
  if (checkingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Background Pattern */}
      <div className="absolute inset-0 z-0 bg-dot-pattern opacity-50 pointer-events-none" />

      {/* Setup Card */}
      <div className="relative z-10 w-full max-w-lg">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="bg-primary/10 p-3 rounded-2xl mb-4">
            <Settings className="w-8 h-8 text-primary" />
          </div>
        </div>

        <Card className="glass-strong border-muted/50 shadow-2xl">
          <CardHeader className="text-center pt-10 pb-4">
            <CardTitle className="text-2xl font-bold tracking-tight">
              系统初始化向导
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              首次运行需要配置系统参数
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {renderStepIndicator()}

            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold">{stepTitles[step].title}</h2>
              <p className="text-sm text-muted-foreground">
                {stepTitles[step].desc}
              </p>
            </div>

            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </CardContent>

          {!initStatus.success && (
            <CardFooter className="flex justify-between border-t border-muted/50 pt-6">
              {step > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={goToPrevStep}
                  disabled={initStatus.inProgress}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  上一步
                </Button>
              ) : (
                <div />
              )}

              {step < 3 && (
                <Button
                  type="button"
                  onClick={goToNextStep}
                  disabled={
                    (step === 1 && !dbValidation.success) ||
                    (step === 2 && !validateStep2().valid)
                  }
                >
                  下一步
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardFooter>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Clash Config Manager &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
