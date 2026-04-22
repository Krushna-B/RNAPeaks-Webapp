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
RUN R -e "install.packages('remotes', repos='https://cloud.r-project.org')"
RUN for attempt in 1 2 3; do \
      R -e "remotes::install_github('Krushna-B/RNAPeaks', dependencies=TRUE, upgrade='never')" \
      && break || { echo "RNAPeaks attempt $attempt failed, retrying..."; sleep 15; }; \
    done && \
    R -e "library(RNAPeaks); message('RNAPeaks installed successfully')"

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

# Pre-cache both GTF records at build time.
# We call AnnotationHub directly with localHub=FALSE so that the Human download
# does not cause the subsequent Mouse download to incorrectly switch to
# localHub=TRUE (which fails because the Mouse record isn't cached yet).
RUN R -e " \
  library(AnnotationHub); \
  ah <- AnnotationHub(ask = FALSE, localHub = FALSE); \
  invisible(ah[['AH110867']]); \
  invisible(ah[['AH47076']]); \
  message('GTF pre-cache complete') \
"

COPY plumber.R  /app/plumber.R
COPY nginx.conf /etc/nginx/nginx.conf.template
COPY start.sh   /app/start.sh
RUN chmod +x /app/start.sh

WORKDIR /app

# Dev Mode requires /app owned by uid 1000
RUN useradd -m -u 1000 user && chown -R user /app

EXPOSE 7860

CMD ["/app/start.sh"]
