import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import ContentPaste from '@mui/icons-material/ContentPaste';
import CloudUpload from '@mui/icons-material/CloudUpload';
import CameraAlt from '@mui/icons-material/CameraAlt';
import Share from '@mui/icons-material/Share';
import SendToMobile from '@mui/icons-material/SendToMobile';
import Inventory2 from '@mui/icons-material/Inventory2';
import DevicesOther from '@mui/icons-material/DevicesOther';
import Star from '@mui/icons-material/Star';
import InstallMobile from '@mui/icons-material/InstallMobile';
import DarkMode from '@mui/icons-material/DarkMode';

interface FeatureRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureRow({ icon, title, description }: FeatureRowProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
      <Box
        sx={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="subtitle2" fontWeight={600}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>
    </Box>
  );
}

export function HelpContent() {
  return (
    <Box sx={{ pb: 1 }}>
      <FeatureRow
        icon={<ContentPaste fontSize="small" />}
        title="Paste Anything"
        description="Tap the green Paste button or press Ctrl+V / Cmd+V to save text and images from your clipboard instantly."
      />
      <FeatureRow
        icon={<CloudUpload fontSize="small" />}
        title="Upload Files"
        description="Tap Upload to pick files, or drag and drop them anywhere on the page. Supports multi-GB files with progress tracking and cancellation."
      />
      <FeatureRow
        icon={<CameraAlt fontSize="small" />}
        title="Camera Capture"
        description="On mobile, tap the Camera button to snap a photo and save it directly."
      />
      <FeatureRow
        icon={<Share fontSize="small" />}
        title="Public Sharing"
        description="Tap the link icon on any item to generate a public share URL. Recipients don't need an account to view it."
      />
      <FeatureRow
        icon={<SendToMobile fontSize="small" />}
        title="Share Target"
        description="On Android, share files, images, or text from any app directly into Clipboard. Install the app first, then use your device's Share menu."
      />
      <FeatureRow
        icon={<Star fontSize="small" />}
        title="Favorites"
        description="Star important items to pin them at the top and protect them from auto-archival retention policies."
      />
      <FeatureRow
        icon={<Inventory2 fontSize="small" />}
        title="Archive & Batch Operations"
        description="Archive items to declutter your clipboard. Multi-select items for bulk archive, restore, or permanent delete."
      />
      <FeatureRow
        icon={<DevicesOther fontSize="small" />}
        title="Cross-Device Sync"
        description="Items appear in real-time on all your logged-in devices via WebSockets. No manual refresh needed."
      />
      <FeatureRow
        icon={<InstallMobile fontSize="small" />}
        title="Installable PWA"
        description="Add to your home screen for a native app experience. On Android, share content from any app directly into Clipboard."
      />
      <FeatureRow
        icon={<DarkMode fontSize="small" />}
        title="Dark / Light Theme"
        description="Toggle between themes via the user menu. Your preference persists across sessions."
      />
    </Box>
  );
}
