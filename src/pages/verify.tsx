import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Typography, Container, Paper, Box, TextField, Stack } from '@mui/material';
import { Button } from "@/components/ui/button";
import { useVerification } from '@/contexts/VerificationContext';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function VerifyPage() {
  const router = useRouter();
  const { isVerified, setVerified } = useVerification();
  
  // Mock verification states
  const [email, setEmail] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  
  // Простая валидация email
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };
  
  // Обработчик верификации
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setVerifying(true);
      setError(null);
      
      // Проверяем форму
      if (!name.trim()) throw new Error('Please enter your name');
      if (!email.trim() || !isValidEmail(email)) throw new Error('Please enter a valid email');
      if (!phone.trim()) throw new Error('Please enter your phone number');
      
      // Здесь в будущем будет вызов реального API для верификации
      // Пока просто имитируем задержку
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // Устанавливаем статус верификации
      setVerified(true);
      setSuccess(true);
      
      // Перенаправляем после успешной верификации
      setTimeout(() => {
        // Перенаправляем на страницу запроса помощи или откуда пришли
        const { returnUrl } = router.query;
        router.push(typeof returnUrl === 'string' ? returnUrl : '/');
      }, 2000);
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };
  
  // Если пользователь уже верифицирован, показываем соответствующее сообщение
  if (isVerified && !success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
        <Head>
          <title>Verification - Helping Hand</title>
          <meta
            content="Verify your identity to use the Helping Hand platform"
            name="description"
          />
          <link href="/favicon.ico" rel="icon" />
        </Head>

        <Navigation isVerified={isVerified} onAskForHelp={() => router.push('/createhelprequest')} />

        <Container maxWidth="sm" sx={{ py: 8 }}>
          <Paper sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
              <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <Typography variant="h4" gutterBottom>Already Verified</Typography>
              <Typography variant="body1" paragraph>
                Your account is already verified. You can now create help requests and contribute to others.
              </Typography>
              <Button
                className="mt-4"
                onClick={() => router.push('/lendahand')}
              >
                Browse Help Requests
              </Button>
            </Box>
          </Paper>
        </Container>

        <Footer />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Head>
        <title>Verification - Helping Hand</title>
        <meta
          content="Verify your identity to use the Helping Hand platform"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <Navigation isVerified={isVerified} onAskForHelp={() => router.push('/createhelprequest')} />

      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center" className="font-bold mb-8 bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent">
          Verify Your Identity
        </Typography>
        
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert className="mb-6 bg-green-50 border-green-500">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle>Successfully Verified</AlertTitle>
            <AlertDescription>
              Your identity has been verified! Redirecting you...
            </AlertDescription>
          </Alert>
        )}
        
        <Paper sx={{ p: 4 }}>
          <Typography variant="body1" paragraph>
            To ensure the safety and trust of our community, we need to verify your identity before you can create help requests.
          </Typography>
          
          <form onSubmit={handleVerify}>
            <Stack spacing={3}>
              <TextField
                label="Full Name"
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={verifying || success}
                required
              />
              
              <TextField
                label="Email Address"
                type="email"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={verifying || success}
                required
              />
              
              <TextField
                label="Phone Number"
                fullWidth
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={verifying || success}
                required
              />
              
              <Button
                className="w-full py-6 text-lg font-semibold mt-4" 
                size="lg"
                type="submit"
                disabled={verifying || success}
              >
                {verifying ? 'Verifying...' : 'Verify Identity'}
              </Button>
            </Stack>
          </form>
        </Paper>
      </Container>

      <Footer />
    </div>
  );
}
