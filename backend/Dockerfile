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
  wget \
  git \
  git-lfs \
  procps \
  gettext-base \
  && rm -rf /var/lib/apt/lists/*

# Install BiocManager + core dependencies
RUN R -e "install.packages('BiocManager', repos='https://cloud.r-project.org')"
RUN R -e "BiocManager::install(c('GenomicRanges', 'AnnotationHub', 'BiocFileCache'), ask=FALSE)"

# Install RNAPeaks from GitHub (pulls all CRAN/Bioc deps automatically)
RUN for attempt in 1 2 3; do \
      R -e "install.packages('remotes', repos='https://cloud.r-project.org'); \
            remotes::install_github('Krushna-B/RNAPeaks', dependencies=TRUE, upgrade='never'); \
            if (!requireNamespace('RNAPeaks', quietly=TRUE)) stop('failed')" \
      && break || { echo "RNAPeaks attempt $attempt failed, retrying..."; sleep 15; }; \
    done

# Install BSgenome packages at build time (each in its own layer with retry)
RUN for attempt in 1 2 3; do \
      R -e "BiocManager::install('BSgenome.Hsapiens.UCSC.hg38', ask=FALSE); \
            if (!requireNamespace('BSgenome.Hsapiens.UCSC.hg38', quietly=TRUE)) stop('failed')" \
      && break || { echo "hg38 attempt $attempt failed, retrying..."; sleep 10; }; \
    done
RUN for attempt in 1 2 3; do \
      R -e "BiocManager::install('BSgenome.Mmusculus.UCSC.mm10', ask=FALSE); \
            if (!requireNamespace('BSgenome.Mmusculus.UCSC.mm10', quietly=TRUE)) stop('failed')" \
      && break || { echo "mm10 attempt $attempt failed, retrying..."; sleep 10; }; \
    done

# Install plumber, uuid, and digest (digest::hmac used to verify upload tokens)
RUN R -e "install.packages(c('plumber', 'uuid', 'digest'), repos='https://cloud.r-project.org'); library(plumber)"

# Pre-cache the GTF at build time so cold starts don't need to download it
RUN R -e "library(RNAPeaks); LoadGTF(species='Human'); LoadGTF(species='Mouse')"

COPY plumber.R  /app/plumber.R
COPY nginx.conf /etc/nginx/nginx.conf.template
COPY start.sh   /app/start.sh
RUN chmod +x /app/start.sh

WORKDIR /app

# Dev Mode requires /app owned by uid 1000
RUN useradd -m -u 1000 user && chown -R user /app

EXPOSE 7860

CMD ["/app/start.sh"]
