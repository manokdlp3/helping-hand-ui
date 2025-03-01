import React from 'react';
import Link from 'next/link';
import { AppBar, Toolbar, Typography, Button, Box, Container, Drawer, List, ListItem, ListItemButton, ListItemText, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Menu as MenuIcon, User, Wallet } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface NavigationProps {
  isVerified: boolean;
  onAskForHelp: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ isVerified, onAskForHelp }) => {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' || (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return;
    }
    setDrawerOpen(open);
  };

  const navLinks = [
    { title: 'Help Others', path: '/lendahand' },
    { title: 'How It Works', path: '/how-it-works' },
  ];
  
  // If user is verified, add profile link
  if (isVerified) {
    navLinks.push({ title: 'My Profile', path: '/profile' });
  }

  const drawer = (
    <Box
      sx={{ width: 250 }}
      role="presentation"
      onClick={toggleDrawer(false)}
      onKeyDown={toggleDrawer(false)}
    >
      <List>
        {navLinks.map((link, index) => (
          <ListItem key={link.title} disablePadding>
            <Link href={link.path} passHref style={{ textDecoration: 'none', width: '100%' }}>
              <ListItemButton>
                <ListItemText primary={link.title} />
              </ListItemButton>
            </Link>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <AppBar position="static" sx={{ backgroundColor: 'background.paper', boxShadow: 1, color: 'text.primary' }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
          <Typography
            variant="h6"
            component="div"
            sx={{ 
              fontSize: { xs: '1.25rem', md: '1.5rem' },
              fontWeight: 'bold',
              color: 'green.800',
              mr: 2,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Link href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}>
              <Box component="img" src="/logo.png" alt="Logo" sx={{ height: 40, mr: 1, display: { xs: 'none', sm: 'block' } }} />
              Helping Hand
            </Link>
          </Typography>

          {isMobile ? (
            <Box>
              <ConnectButton accountStatus="avatar" />
              <IconButton
                size="large"
                edge="end"
                color="inherit"
                aria-label="menu"
                onClick={toggleDrawer(true)}
                sx={{ ml: 1 }}
              >
                <MenuIcon />
              </IconButton>
              <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={toggleDrawer(false)}
              >
                {drawer}
              </Drawer>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ display: 'flex', mr: 2 }}>
                {navLinks.map((link) => (
                  <Link key={link.title} href={link.path} passHref>
                    <Button 
                      color="inherit"
                      sx={{ 
                        mx: 1,
                        textTransform: 'none',
                        fontWeight: 'medium',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 128, 0, 0.1)',
                        }
                      }}
                    >
                      {link.title}
                    </Button>
                  </Link>
                ))}
              </Box>

              <ConnectButton />

              <Button
                variant="contained"
                onClick={onAskForHelp}
                sx={{
                  ml: 2,
                  backgroundColor: 'green.600',
                  '&:hover': {
                    backgroundColor: 'green.700',
                  },
                  color: 'white',
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 'medium',
                  px: 3,
                }}
              >
                {isVerified ? 'Create Help Request' : 'Ask for Help'}
              </Button>
              
              {isVerified && (
                <Link href="/profile" passHref>
                  <IconButton 
                    color="inherit" 
                    sx={{ 
                      ml: 1,
                      '&:hover': {
                        backgroundColor: 'rgba(0, 128, 0, 0.1)',
                      }
                    }}
                  >
                    <User size={20} />
                  </IconButton>
                </Link>
              )}
            </Box>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}; 