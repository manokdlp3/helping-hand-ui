import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useVerification } from '@/contexts/VerificationContext';
import { useContract } from '@/hooks/useContract';
import { TextField, Typography, Container, Paper, Box, FormControl, InputLabel, Select, MenuItem, FormHelperText } from '@mui/material';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from 'lucide-react';

// Получить текущую дату + 30 дней в формате строки для инпута
const getDefaultEndDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split('T')[0];
};

export default function CreateHelpRequest() {
  const router = useRouter();
  const { isVerified } = useVerification();
  const { contract, contractError, isLoading } = useContract();
  
  // Form states
  const [subject, setSubject] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const [amountNeeded, setAmountNeeded] = useState<string>('');
  const [endDate, setEndDate] = useState<string>(getDefaultEndDate());
  
  // UI states
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Проверка авторизации
  if (!isVerified) {
    // Если пользователь не верифицирован, перенаправляем на страницу верификации
    if (typeof window !== 'undefined') {
      router.push('/verify');
    }
    return null;
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      setError(null);
      
      if (!contract) {
        throw new Error(contractError || 'Контракт не инициализирован');
      }
      
      // Валидация формы
      if (!subject.trim()) throw new Error('Пожалуйста, укажите тему запроса');
      if (!details.trim()) throw new Error('Пожалуйста, добавьте описание запроса');
      if (!amountNeeded.trim() || isNaN(parseFloat(amountNeeded)) || parseFloat(amountNeeded) <= 0) {
        throw new Error('Пожалуйста, укажите корректную сумму');
      }
      if (!endDate) throw new Error('Пожалуйста, укажите дату окончания сбора');
      
      // Преобразуем дату в timestamp
      const endDateTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
      
      // Преобразуем сумму в нужный формат
      const amountInUSDC = parseFloat(amountNeeded);
      
      // Вызываем смарт-контракт
      const tx = await contract.addFundraiser(
        endDateTimestamp,
        subject,
        details,
        amountInUSDC
      );
      
      // Ждем завершения транзакции
      const receipt = await tx.wait();
      
      // Получаем ID созданного фандрайзера из события
      const event = receipt.events?.find((e: any) => e.event === 'FundraiserCreated');
      const fundraiserId = event?.args[0];
      
      setSuccess(true);
      
      // Перенаправляем на страницу созданного фандрайзера через 2 секунды
      setTimeout(() => {
        router.push(`/helprequest?helpRequestId=${fundraiserId}`);
      }, 2000);
    } catch (err: any) {
      console.error('Error creating fundraiser:', err);
      setError(err.message || 'Не удалось создать запрос на помощь');
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Head>
        <title>Create Help Request - Helping Hand</title>
        <meta
          content="Create a new help request on the Helping Hand platform"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <Navigation isVerified={isVerified} onAskForHelp={() => {}} />

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center" className="font-bold mb-8 bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent">
          Create a Help Request
        </Typography>
        
        {isLoading && (
          <Paper sx={{ p: 4, mb: 4 }}>
            <Typography>Connecting to the blockchain...</Typography>
            <div className="w-full mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 animate-pulse rounded-full"></div>
            </div>
          </Paper>
        )}
        
        {contractError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {contractError}
            </AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert className="mb-6 bg-green-50 border-green-500">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle>Successfully Created</AlertTitle>
            <AlertDescription>
              Your help request has been successfully created! Redirecting you to the request page...
            </AlertDescription>
          </Alert>
        )}
        
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}
        
        <Paper sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            <TextField
              label="Request Title"
              fullWidth
              margin="normal"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={submitting || success}
              required
            />
            
            <TextField
              label="Details"
              fullWidth
              margin="normal"
              multiline
              rows={6}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              helperText="Describe why you need help and how it will be used"
              disabled={submitting || success}
              required
            />
            
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <TextField
                label="Amount Needed (USDC)"
                type="number"
                fullWidth
                margin="normal"
                value={amountNeeded}
                onChange={(e) => setAmountNeeded(e.target.value)}
                disabled={submitting || success}
                required
                inputProps={{ min: "1", step: "1" }}
              />
              
              <TextField
                label="End Date"
                type="date"
                fullWidth
                margin="normal"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={submitting || success}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            
            <Button
              className="w-full mt-6 py-6 text-lg font-semibold"
              size="lg"
              type="submit"
              disabled={submitting || success || isLoading || !!contractError}
            >
              {submitting ? 'Creating...' : 'Create Help Request'}
            </Button>
          </form>
        </Paper>
      </Container>

      <Footer />
    </div>
  );
} 