import torch
import torch.nn as nn
import torch.nn.functional as F

class ResidualBlock(nn.Module):
    """
    Novelty 1: Residual Block
    Replaces standard double conv. Helps in training deeper networks 
    and preserving feature identity.
    """
    def __init__(self, in_c, out_c):
        super().__init__()
        self.conv1 = nn.Conv2d(in_c, out_c, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(out_c)
        self.conv2 = nn.Conv2d(out_c, out_c, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(out_c)
        
        # Shortcut connection to match dimensions
        self.shortcut = nn.Sequential()
        if in_c != out_c:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_c, out_c, kernel_size=1, padding=0),
                nn.BatchNorm2d(out_c)
            )

    def forward(self, x):
        shortcut = self.shortcut(x)
        x = F.relu(self.bn1(self.conv1(x)))
        x = self.bn2(self.conv2(x))
        x += shortcut  # The "Residual" connection
        return F.relu(x)

class AttentionGate(nn.Module):
    """
    Novelty 2: Attention Gate
    Filters the skip connection features. It uses the coarser signal 
    from the decoder (g) to highlight relevant regions in the encoder features (x).
    """
    def __init__(self, in_c, gate_c, inter_c):
        super().__init__()
        # W_g: Transform gating signal
        self.Wg = nn.Sequential(
            nn.Conv2d(gate_c, inter_c, kernel_size=1, padding=0),
            nn.BatchNorm2d(inter_c)
        )
        # W_x: Transform skip connection
        self.Wx = nn.Sequential(
            nn.Conv2d(in_c, inter_c, kernel_size=1, padding=0),
            nn.BatchNorm2d(inter_c)
        )
        # Psi: Combine and activate
        self.psi = nn.Sequential(
            nn.Conv2d(inter_c, 1, kernel_size=1, padding=0),
            nn.BatchNorm2d(1),
            nn.Sigmoid()
        )
        
    def forward(self, x, g):
        g1 = self.Wg(g)
        x1 = self.Wx(x)
        psi = F.relu(g1 + x1)
        psi = self.psi(psi)
        return x * psi  # Scale the skip connection by the attention map

class ResAttUNet(nn.Module):
    def __init__(self, in_channels=3, out_channels=1):
        super().__init__()
        
        # --- Encoder (Downsampling) ---
        self.e1 = ResidualBlock(in_channels, 64)
        self.e2 = ResidualBlock(64, 128)
        self.e3 = ResidualBlock(128, 256)
        self.e4 = ResidualBlock(256, 512)
        
        self.pool = nn.MaxPool2d(2, 2)
        
        # --- Bridge ---
        self.b = ResidualBlock(512, 1024)
        
        # --- Decoder (Upsampling + Attention) ---
        
        # Up 1
        self.up1 = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=True)
        self.att1 = AttentionGate(in_c=512, gate_c=1024, inter_c=256)
        self.d1 = ResidualBlock(1024 + 512, 512)
        
        # Up 2
        self.up2 = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=True)
        self.att2 = AttentionGate(in_c=256, gate_c=512, inter_c=128)
        self.d2 = ResidualBlock(512 + 256, 256)
        
        # [NEW] Deep Supervision Output 2 (from 256 channels)
        self.ds_out3 = nn.Conv2d(256, out_channels, kernel_size=1) 
        
        # Up 3
        self.up3 = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=True)
        self.att3 = AttentionGate(in_c=128, gate_c=256, inter_c=64)
        self.d3 = ResidualBlock(256 + 128, 128)

        # [NEW] Deep Supervision Output 3 (from 128 channels)
        self.ds_out2 = nn.Conv2d(128, out_channels, kernel_size=1)
        
        # Up 4
        self.up4 = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=True)
        self.att4 = AttentionGate(in_c=64, gate_c=128, inter_c=32)
        self.d4 = ResidualBlock(128 + 64, 64)
        
        # Output (Final)
        self.out = nn.Conv2d(64, out_channels, kernel_size=1)
        
    def forward(self, x):
        # Encoder
        x1 = self.e1(x)
        p1 = self.pool(x1)
        
        x2 = self.e2(p1)
        p2 = self.pool(x2)
        
        x3 = self.e3(p2)
        p3 = self.pool(x3)
        
        x4 = self.e4(p3)
        p4 = self.pool(x4)
        
        # Bridge
        b = self.b(p4)
        
        # Decoder
        
        # Block 1
        d1 = self.up1(b)
        x4 = self.att1(x=x4, g=d1)
        d1 = torch.cat((x4, d1), dim=1)
        d1 = self.d1(d1)
        
        # Block 2
        d2 = self.up2(d1)
        x3 = self.att2(x=x3, g=d2)
        d2 = torch.cat((x3, d2), dim=1)
        d2 = self.d2(d2)
        # [NEW] Capture Intermediate Output (1/4 resolution)
        out3 = self.ds_out3(d2)

        # Block 3
        d3 = self.up3(d2)
        x2 = self.att3(x=x2, g=d3)
        d3 = torch.cat((x2, d3), dim=1)
        d3 = self.d3(d3)
        # [NEW] Capture Intermediate Output (1/2 resolution)
        out2 = self.ds_out2(d3)
        
        # Block 4
        d4 = self.up4(d3)
        x1 = self.att4(x=x1, g=d4)
        d4 = torch.cat((x1, d4), dim=1)
        d4 = self.d4(d4)
        
        # Final Output
        out_final = self.out(d4)
        
        # [NEW] Return List: [Final, Middle, Coarse]
        # We must upsample the smaller maps to match the input size for Loss calculation
        return [
            out_final,
            F.interpolate(out2, scale_factor=2, mode='bilinear', align_corners=True),
            F.interpolate(out3, scale_factor=4, mode='bilinear', align_corners=True)
        ]