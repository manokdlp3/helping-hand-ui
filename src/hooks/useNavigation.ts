import { useRouter } from 'next/router';

export const useNavigation = (isVerified: boolean) => {
  const router = useRouter();

  const handleLendAHand = () => {
    if (!isVerified) {
      router.push('/verify');
      return;
    }
    router.push('/helprequest');
  };

  return { handleLendAHand };
}; 