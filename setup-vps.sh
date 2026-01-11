#!/bin/bash

# CGBAS VPS Setup Script - Ubuntu 20.04/22.04
# Run with: bash setup-vps.sh

set -e  # Exit on error

echo "================================"
echo "🚀 CGBAS VPS Setup Script"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    print_error "Please do not run as root. Run as normal user with sudo privileges."
    exit 1
fi

# Step 1: Update system
print_info "Step 1/8: Updating system..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git wget nano ufw
print_success "System updated"

# Step 2: Setup firewall
print_info "Step 2/8: Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo "y" | sudo ufw enable
print_success "Firewall configured"

# Step 3: Install Docker
print_info "Step 3/8: Installing Docker..."
if ! command -v docker &> /dev/null; then
    # Remove old versions
    sudo apt remove -y docker docker-engine docker.io containerd runc || true
    
    # Install dependencies
    sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release
    
    # Add Docker GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io
    
    # Start Docker
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    
    print_success "Docker installed: $(docker --version)"
else
    print_success "Docker already installed: $(docker --version)"
fi

# Step 4: Install Docker Compose
print_info "Step 4/8: Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    print_success "Docker Compose installed: $(docker-compose --version)"
else
    print_success "Docker Compose already installed: $(docker-compose --version)"
fi

# Step 5: Create project directory
print_info "Step 5/8: Setting up project directory..."
sudo mkdir -p /opt/cgbasv2
sudo chown $USER:$USER /opt/cgbasv2
print_success "Project directory created: /opt/cgbasv2"

# Step 6: Clone repository
print_info "Step 6/8: Cloning repository..."
cd /opt/cgbasv2
if [ -d ".git" ]; then
    print_info "Repository exists, pulling latest..."
    git pull origin main
else
    git clone https://github.com/Nguyen15idhue/cgbasv2.git .
fi
print_success "Repository cloned"

# Step 7: Setup environment
print_info "Step 7/8: Setting up environment..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    
    # Generate random secrets
    SESSION_SECRET=$(openssl rand -base64 32)
    DB_PASS=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)
    
    # Update .env
    sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env
    sed -i "s/DB_PASS=.*/DB_PASS=$DB_PASS/" .env
    
    chmod 600 .env
    
    print_success "Environment file created with random secrets"
    print_info "⚠️  Please edit /opt/cgbasv2/.env and update API credentials"
    print_info "    nano /opt/cgbasv2/.env"
else
    print_success "Environment file already exists"
fi

# Step 8: Install Nginx
print_info "Step 8/8: Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    print_success "Nginx installed"
else
    print_success "Nginx already installed"
fi

# Summary
echo ""
echo "================================"
echo "✅ Setup Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Edit environment file:"
echo "   nano /opt/cgbasv2/.env"
echo ""
echo "2. Start production:"
echo "   cd /opt/cgbasv2"
echo "   docker-compose --profile prod up -d"
echo ""
echo "3. Check logs:"
echo "   docker-compose logs -f"
echo ""
echo "4. Setup Nginx reverse proxy (see DEPLOY_VPS.md section 6)"
echo ""
echo "5. Setup SSL with Let's Encrypt (see DEPLOY_VPS.md section 7)"
echo ""
echo "⚠️  IMPORTANT: You may need to logout and login again for Docker group to take effect"
echo ""
