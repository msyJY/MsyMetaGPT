import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Wifi, 
  WifiOff, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  RefreshCw
} from 'lucide-react';
import { metaGPTAPI } from '../services/api';

const StatusIndicator = () => {
  const [status, setStatus] = useState('checking'); // checking, online, offline, error
  const [lastCheck, setLastCheck] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = async () => {
    setIsChecking(true);
    try {
      const result = await metaGPTAPI.healthCheck();
      setStatus(result.status === 'ok' ? 'online' : 'error');
      setLastCheck(new Date());
    } catch (error) {
      setStatus('offline');
      setLastCheck(new Date());
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    
    // 每30秒检查一次状态
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          icon: CheckCircle,
          color: 'bg-green-500',
          text: '在线',
          variant: 'default',
          description: 'MetaGPT服务正常运行'
        };
      case 'offline':
        return {
          icon: WifiOff,
          color: 'bg-red-500',
          text: '离线',
          variant: 'destructive',
          description: '无法连接到MetaGPT服务'
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'bg-yellow-500',
          text: '异常',
          variant: 'secondary',
          description: 'MetaGPT服务出现异常'
        };
      default:
        return {
          icon: Clock,
          color: 'bg-gray-500',
          text: '检查中',
          variant: 'outline',
          description: '正在检查服务状态'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <div className="flex items-center space-x-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={config.variant} className="gap-1 cursor-pointer">
              <div className={`w-2 h-2 rounded-full ${config.color} ${status === 'checking' ? 'animate-pulse' : ''}`} />
              <Icon className="w-3 h-3" />
              <span className="text-xs">{config.text}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <div>{config.description}</div>
              {lastCheck && (
                <div className="text-xs text-muted-foreground mt-1">
                  最后检查: {lastCheck.toLocaleTimeString()}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        <Button
          variant="ghost"
          size="sm"
          onClick={checkStatus}
          disabled={isChecking}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </TooltipProvider>
  );
};

export default StatusIndicator;

