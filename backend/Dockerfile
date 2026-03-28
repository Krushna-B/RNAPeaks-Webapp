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

# Install BSgenome at build time
RUN R -e "BiocManager::install('BSgenome.Hsapiens.UCSC.hg38', ask=FALSE)"

# Install plumber and uuid
RUN R -e "install.packages(c('plumber', 'uuid'), repos='https://cloud.r-project.org'); library(plumber)"

COPY plumber.R  /app/plumber.R
COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh   /app/start.sh
RUN chmod +x /app/start.sh

WORKDIR /app

EXPOSE 7860

CMD ["/app/start.sh"]
