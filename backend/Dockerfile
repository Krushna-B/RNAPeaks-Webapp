FROM rocker/r-ver:4.3.3

# System dependencies for Bioconductor packages + nginx
RUN apt-get update && apt-get install -y \
  libcurl4-openssl-dev \
  libssl-dev \
  libxml2-dev \
  libfontconfig1-dev \
  libharfbuzz-dev \
  libfribidi-dev \
  libfreetype6-dev \
  libpng-dev \
  libtiff5-dev \
  libjpeg-dev \
  libgit2-dev \
  libsodium-dev \
  libbz2-dev \
  liblzma-dev \
  zlib1g-dev \
  nginx \
  curl \
  git \
  gettext-base \
  && rm -rf /var/lib/apt/lists/*

# Install BiocManager + core dependencies
RUN R -e "install.packages('BiocManager', repos='https://cloud.r-project.org')"
RUN R -e "BiocManager::install(c('GenomicRanges', 'AnnotationHub', 'BiocFileCache'), ask=FALSE)"

# Install RNAPeaks from GitHub (pulls all CRAN/Bioc deps automatically)
RUN R -e " \
  install.packages('remotes', repos='https://cloud.r-project.org'); \
  remotes::install_github('Krushna-B/RNAPeaks', dependencies=TRUE, upgrade='always'); \
  if (!requireNamespace('RNAPeaks', quietly=TRUE)) stop('RNAPeaks installation failed') \
  "

# Install BSgenome packages at build time
RUN R -e " \
  BiocManager::install(c('BSgenome.Hsapiens.UCSC.hg38', 'BSgenome.Mmusculus.UCSC.mm10'), ask=FALSE); \
  if (!requireNamespace('BSgenome.Hsapiens.UCSC.hg38', quietly=TRUE)) stop('BSgenome.Hsapiens.UCSC.hg38 install failed'); \
  if (!requireNamespace('BSgenome.Mmusculus.UCSC.mm10', quietly=TRUE)) stop('BSgenome.Mmusculus.UCSC.mm10 install failed') \
  "

# Install plumber, uuid, and digest (digest::hmac used to verify upload tokens)
RUN R -e "install.packages(c('plumber', 'uuid', 'digest'), repos='https://cloud.r-project.org'); library(plumber)"

# Pre-cache the GTF at build time so cold starts don't need to download it
RUN R -e "library(RNAPeaks); LoadGTF(species='Human'); LoadGTF(species='Mouse')"

COPY plumber.R  /app/plumber.R
COPY nginx.conf /etc/nginx/nginx.conf.template
COPY start.sh   /app/start.sh
RUN chmod +x /app/start.sh

WORKDIR /app

EXPOSE 7860


CMD ["/app/start.sh"]
