import React from 'react';
import { Redirect } from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Head from '@docusaurus/Head';

export default function Home() {
  const targetUrl = useBaseUrl('/docs/what-is-gallery-view');
  return (
    <>
      <Head>
        <meta http-equiv="refresh" content={`0; url=${targetUrl}`} />
      </Head>
      <Redirect to={targetUrl} />
    </>
  );
}
