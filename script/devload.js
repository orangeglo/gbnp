if (document.location.href.includes('file://')) {
  const head = document.getElementsByTagName('head')[0];
  const devScript = document.createElement('script');
  devScript.type = 'text/javascript';
  devScript.src = 'script/vue.js';

  const thisScript = document.getElementById('devload');
  thisScript.parentNode.insertBefore(devScript, thisScript.nextSibling);
  console.log('Development Mode')
}
